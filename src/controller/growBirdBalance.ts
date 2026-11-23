import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import supabase from "../utils/supabase";
import { loadGrowReductionTransactionsByGrowId } from "./growLogsCrud";

dayjs.extend(utc);

export type GrowBirdBalanceSource = {
  id: string;
  growId: number;
  growCreatedAt: string;
  total: number;
};

const GROWS_TABLE = import.meta.env.VITE_SUPABASE_GROWS_TABLE ?? "Grows";
const GROW_LOGS_TABLE = import.meta.env.VITE_SUPABASE_GROW_LOGS_TABLE ?? "GrowLogs";
const LOAD_TABLE = import.meta.env.VITE_SUPABASE_LOAD_TABLE ?? "Load";
const LOAD_TRANSACTIONS_TABLE = import.meta.env.VITE_SUPABASE_LOAD_TRANSACTIONS_TABLE ?? "LoadTransactions";
const DOA_TRANSACTIONS_TABLE = import.meta.env.VITE_SUPABASE_DOA_TRANSACTIONS_TABLE ?? "DOATransactions";
const CULLED_TRANSACTIONS_TABLE = import.meta.env.VITE_SUPABASE_CULLED_TRANSACTIONS_TABLE ?? "CulledTransactions";
const TRANSFER_TRANSACTIONS_TABLE = import.meta.env.VITE_SUPABASE_TRANSFER_TRANSACTIONS_TABLE ?? "TransferTransactions";

const toNonNegativeInt = (value: unknown): number => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, Math.floor(numberValue)) : 0;
};

// One source for the Harvest overview, reduction-entry limits, truck loading,
// and automatic completion. Saved GrowLogs.actual_total_animals may be stale.
export async function loadGrowCurrentTotals(
  buildings: GrowBirdBalanceSource[], selectedDate: string
): Promise<Record<string, number>> {
  if (buildings.length === 0) return {};
  const selectedDayEnd = `${dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD")}T00:00:00+00:00`;
  const growIds = buildings
    .map((building) => building.growId)
    .filter((growId): growId is number => Number.isFinite(growId));

  if (growIds.length === 0) {
    return {};
  }

  const growStartDayByGrowId = Object.fromEntries(
    buildings.map((building) => [building.growId, dayjs.utc(building.growCreatedAt).startOf("day")])
  ) as Record<number, dayjs.Dayjs>;
  const isOnOrAfterGrowStart = (growId: number, createdAt: string): boolean => {
    const growStartDay = growStartDayByGrowId[growId];
    return !growStartDay || !dayjs.utc(createdAt).startOf("day").isBefore(growStartDay);
  };

  const [loadResult, doaResult, culledResult, transferResult, growLogsResult] = await Promise.all([
    supabase.from(LOAD_TABLE).select("id, grow_id").in("grow_id", growIds),
    supabase
      .from(DOA_TRANSACTIONS_TABLE)
      .select("grow_id, total_animals_count, created_at")
      .in("grow_id", growIds)
      .lt("created_at", selectedDayEnd),
    supabase
      .from(CULLED_TRANSACTIONS_TABLE)
      .select("grow_id, total_animals_count, created_at")
      .in("grow_id", growIds)
      .lt("created_at", selectedDayEnd),
    supabase
      .from(TRANSFER_TRANSACTIONS_TABLE)
      .select("grow_id, total_animals_count, created_at")
      .in("grow_id", growIds)
      .lt("created_at", selectedDayEnd),
    supabase
      .from(GROW_LOGS_TABLE)
      .select("grow_id, subbuilding_id, mortality, thinning, take_out, created_at")
      .in("grow_id", growIds)
      .lt("created_at", selectedDayEnd)
      .order("created_at", { ascending: false }),
  ]);

  for (const result of [loadResult, doaResult, culledResult, transferResult, growLogsResult]) {
    if (result.error) throw result.error;
  }

  const growIdByLoadId: Record<number, number> = {};
  ((loadResult.data ?? []) as Array<{ id: number | null; grow_id: number | null }>).forEach((row) => {
    if (row.id == null || row.grow_id == null) return;
    growIdByLoadId[row.id] = row.grow_id;
  });

  const grossLoadedByGrowId: Record<number, number> = {};
  const loadIds = Object.keys(growIdByLoadId).map(Number);
  if (loadIds.length > 0) {
    const { data: loadTransactions, error: loadTransactionsError } = await supabase
      .from(LOAD_TRANSACTIONS_TABLE)
      .select("load_id, animal_count, created_at")
      .in("load_id", loadIds)
      .lt("created_at", selectedDayEnd);
    if (loadTransactionsError) throw loadTransactionsError;

    ((loadTransactions ?? []) as Array<{ load_id: number | null; animal_count: number | null }>).forEach((row) => {
      if (row.load_id == null) return;
      const growId = growIdByLoadId[row.load_id];
      if (growId == null) return;
      grossLoadedByGrowId[growId] =
        (grossLoadedByGrowId[growId] ?? 0) + toNonNegativeInt(row.animal_count);
    });
  }

  const sumSpecialTransactions = (
    rows: unknown[]
  ): Record<number, number> => {
    const totals: Record<number, number> = {};
    (rows as Array<{ grow_id: number | null; total_animals_count: number | null; created_at: string }>).forEach((row) => {
      if (row.grow_id == null || !isOnOrAfterGrowStart(row.grow_id, row.created_at)) return;
      totals[row.grow_id] = (totals[row.grow_id] ?? 0) + toNonNegativeInt(row.total_animals_count);
    });
    return totals;
  };

  const doaByGrowId = sumSpecialTransactions(doaResult.data ?? []);
  const culledByGrowId = sumSpecialTransactions(culledResult.data ?? []);
  const transferByGrowId = sumSpecialTransactions(transferResult.data ?? []);

  const latestLogByGrowDayAndCage: Record<
    string,
    { growId: number; dayKey: string; cageId: number; mortality: number; thinning: number; takeOut: number }
  > = {};
  const latestMetricFallbackByGrowId: Record<number, { mortality: number; thinning: number; takeOut: number }> = {};
  ((growLogsResult.data ?? []) as Array<{
    grow_id: number | null;
    subbuilding_id: number | null;
    mortality: number | null;
    thinning: number | null;
    take_out: number | null;
    created_at: string;
  }>).forEach((row) => {
    if (row.grow_id == null) return;
    if (!isOnOrAfterGrowStart(row.grow_id, row.created_at)) return;
    if (!latestMetricFallbackByGrowId[row.grow_id]) {
      latestMetricFallbackByGrowId[row.grow_id] = {
        mortality: toNonNegativeInt(row.mortality),
        thinning: toNonNegativeInt(row.thinning),
        takeOut: toNonNegativeInt(row.take_out),
      };
    }
    if (row.subbuilding_id == null) return;
    const dayKey = dayjs.utc(row.created_at).format("YYYY-MM-DD");
    const key = `${row.grow_id}-${dayKey}-${row.subbuilding_id}`;
    if (latestLogByGrowDayAndCage[key]) return;
    latestLogByGrowDayAndCage[key] = {
      growId: row.grow_id,
      dayKey,
      cageId: row.subbuilding_id,
      mortality: toNonNegativeInt(row.mortality),
      thinning: toNonNegativeInt(row.thinning),
      takeOut: toNonNegativeInt(row.take_out),
    };
  });

  const reductionTransactionEntries = await Promise.all(
    growIds.map(async (growId) => [growId, await loadGrowReductionTransactionsByGrowId(growId)] as const)
  );
  const reductionsByGrowId = Object.fromEntries(reductionTransactionEntries);
  const operationalReductionsByGrowId: Record<number, { mortality: number; thinning: number; takeOut: number }> = {};

  growIds.forEach((growId) => {
    const logValues: Record<string, number> = {};
    const logDayTypeByKey: Record<string, string> = {};
    Object.values(latestLogByGrowDayAndCage).forEach((row) => {
      if (row.growId !== growId) return;
      const values = [
        ["mortality", row.mortality],
        ["thinning", row.thinning],
        ["take_out", row.takeOut],
      ] as const;
      values.forEach(([type, value]) => {
        const key = `${row.dayKey}-${row.cageId}-${type}`;
        logValues[key] = value;
        logDayTypeByKey[key] = `${row.dayKey}-${type}`;
      });
    });

    const transactionValues: Record<string, number> = {};
    const transactionDayTypes = new Set<string>();
    (reductionsByGrowId[growId] ?? [])
      .filter(
        (row) =>
          isOnOrAfterGrowStart(growId, row.createdAt) &&
          dayjs.utc(row.createdAt).valueOf() < dayjs.utc(selectedDayEnd).valueOf()
      )
      .sort((a, b) => dayjs.utc(b.createdAt).valueOf() - dayjs.utc(a.createdAt).valueOf())
      .forEach((row) => {
        if (row.subbuildingId == null) return;
        if (row.reductionType !== "mortality" && row.reductionType !== "thinning" && row.reductionType !== "take_out") return;
        const dayKey = dayjs.utc(row.createdAt).format("YYYY-MM-DD");
        const key = `${dayKey}-${row.subbuildingId}-${row.reductionType}`;
        if (transactionValues[key] != null) return;
        transactionValues[key] = toNonNegativeInt(row.animalCount);
        transactionDayTypes.add(`${dayKey}-${row.reductionType}`);
      });

    const totals = { mortality: 0, thinning: 0, takeOut: 0 };
    const addValue = (key: string, value: number) => {
      if (key.endsWith("-mortality")) totals.mortality += value;
      if (key.endsWith("-thinning")) totals.thinning += value;
      if (key.endsWith("-take_out")) totals.takeOut += value;
    };
    Object.entries(transactionValues).forEach(([key, value]) => addValue(key, value));
    Object.entries(logValues).forEach(([key, value]) => {
      if (transactionDayTypes.has(logDayTypeByKey[key])) return;
      addValue(key, value);
    });
    operationalReductionsByGrowId[growId] =
      totals.mortality > 0 || totals.thinning > 0 || totals.takeOut > 0
        ? totals
        : latestMetricFallbackByGrowId[growId] ?? totals;
  });

  const nextCurrentTotals = Object.fromEntries(
    buildings.map((building) => {
      const growId = building.growId;
      const grossLoaded = grossLoadedByGrowId[growId] ?? building.total;
      const adjustedTotal = Math.max(
        0,
        grossLoaded - (doaByGrowId[growId] ?? 0) - (culledByGrowId[growId] ?? 0)
      );
      const reductions = operationalReductionsByGrowId[growId] ?? { mortality: 0, thinning: 0, takeOut: 0 };
      const current = Math.max(
        0,
        adjustedTotal - reductions.mortality - reductions.thinning - reductions.takeOut - (transferByGrowId[growId] ?? 0)
      );
      return [building.id, current];
    })
  );

  return nextCurrentTotals;
}

export async function loadGrowCurrentForHarvest(growId: number, selectedDate: string): Promise<number> {
  const { data: grow, error } = await supabase.from(GROWS_TABLE)
    .select("id, created_at, total_animals").eq("id", growId).single();
  if (error) throw error;
  if (!grow) throw new Error("The grow for this harvest could not be found.");
  const key = String(grow.id);
  const totals = await loadGrowCurrentTotals([{
    id: key, growId: Number(grow.id), growCreatedAt: grow.created_at,
    total: toNonNegativeInt(grow.total_animals),
  }], selectedDate);
  if (totals[key] == null) throw new Error("Unable to calculate the harvest starting bird count.");
  return totals[key];
}
