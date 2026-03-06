import supabase from "../utils/supabase";
import type {
  CreateHarvestLogInput,
  CreateHarvestReductionTransactionInput,
  HarvestLogRecord,
  HarvestLogRow,
  HarvestReductionTransactionRecord,
  HarvestReductionTransactionRow,
  HarvestReductionType,
  ListHarvestLogsFilters,
  ListHarvestReductionTransactionsFilters,
  UpdateHarvestLogInput,
  UpdateHarvestReductionTransactionInput,
} from "../type/harvestLogs.type";

const HARVEST_LOGS_TABLE = import.meta.env.VITE_SUPABASE_HARVEST_LOGS_TABLE ?? "HarvestLogs";
const HARVEST_REDUCTION_TRANSACTIONS_TABLE =
  import.meta.env.VITE_SUPABASE_HARVEST_REDUCTION_TRANSACTIONS_TABLE ?? "HarvestReductionTransactions";

// Optional overrides for DBs with custom column names.
const HARVEST_REDUCTION_ANIMAL_COUNT_COLUMN =
  import.meta.env.VITE_SUPABASE_HARVEST_REDUCTION_ANIMAL_COUNT_COLUMN ?? "animal_count_to_deduct";
const HARVEST_REDUCTION_TYPE_COLUMN =
  import.meta.env.VITE_SUPABASE_HARVEST_REDUCTION_TYPE_COLUMN ?? "reduction_type";

function toNonNegativeInt(value: unknown): number {
  return Math.max(0, Math.floor(Number(value ?? 0)));
}

function normalizeReductionType(value: HarvestReductionTransactionRow["reduction_type"]): HarvestReductionType | null {
  if (
    value === "mortality" ||
    value === "thinning" ||
    value === "takeout" ||
    value === "take_out" ||
    value === "defect"
  ) {
    return value;
  }
  return null;
}

function mapRowToHarvestLog(row: HarvestLogRow): HarvestLogRecord {
  return {
    id: String(row.id),
    createdAt: row.created_at,
    harvestId: row.harvest_id,
    mortality: toNonNegativeInt(row.mortality),
    thinning: toNonNegativeInt(row.thinning),
    takeOut: toNonNegativeInt(row.takeout),
    defect: toNonNegativeInt(row.defect),
  };
}

function mapRowToHarvestReductionTransaction(
  row: HarvestReductionTransactionRow
): HarvestReductionTransactionRecord {
  const configuredCount = row[HARVEST_REDUCTION_ANIMAL_COUNT_COLUMN];
  const rawCount =
    typeof configuredCount === "number" || configuredCount === null
      ? configuredCount
      : (row.animal_count_to_deduct ?? row.animal_count ?? null);

  return {
    id: String(row.id),
    createdAt: row.created_at,
    harvestId: row.harvest_id,
    harvestLogId: row.harvest_log_id,
    animalCount: toNonNegativeInt(rawCount),
    reductionType: normalizeReductionType(row.reduction_type),
    remarks: row.remarks,
  };
}

export async function loadHarvestLogs(filters?: ListHarvestLogsFilters): Promise<HarvestLogRecord[]> {
  let query = supabase
    .from(HARVEST_LOGS_TABLE)
    .select("*")
    .order("created_at", { ascending: filters?.ascending ?? false });

  if (typeof filters?.harvestId === "number") query = query.eq("harvest_id", filters.harvestId);
  if (typeof filters?.createdFrom === "string") query = query.gte("created_at", filters.createdFrom);
  if (typeof filters?.createdTo === "string") query = query.lte("created_at", filters.createdTo);
  if (typeof filters?.limit === "number") query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;

  return (data as HarvestLogRow[]).map(mapRowToHarvestLog);
}

export async function loadHarvestLogsByHarvestId(harvestId: number): Promise<HarvestLogRecord[]> {
  return loadHarvestLogs({ harvestId });
}

export async function loadHarvestLogsByDate(date: string): Promise<HarvestLogRecord[]> {
  const startDate = new Date(`${date}T00:00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);

  return loadHarvestLogs({
    createdFrom: startDate.toISOString(),
    createdTo: endDate.toISOString(),
  });
}

export async function addHarvestLog(input: CreateHarvestLogInput): Promise<HarvestLogRecord> {
  const payload = {
    harvest_id: input.harvestId,
    mortality: toNonNegativeInt(input.mortality),
    thinning: toNonNegativeInt(input.thinning),
    takeout: toNonNegativeInt(input.takeOut),
    defect: toNonNegativeInt(input.defect),
  };

  const { data, error } = await supabase
    .from(HARVEST_LOGS_TABLE)
    .insert([payload])
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToHarvestLog(data as HarvestLogRow);
}

export async function updateHarvestLog(
  id: string | number,
  input: UpdateHarvestLogInput
): Promise<HarvestLogRecord> {
  const payload: Record<string, number | null> = {};

  if ("harvestId" in input) payload.harvest_id = input.harvestId ?? null;
  if ("mortality" in input) payload.mortality = toNonNegativeInt(input.mortality);
  if ("thinning" in input) payload.thinning = toNonNegativeInt(input.thinning);
  if ("takeOut" in input) payload.takeout = toNonNegativeInt(input.takeOut);
  if ("defect" in input) payload.defect = toNonNegativeInt(input.defect);

  const { data, error } = await supabase
    .from(HARVEST_LOGS_TABLE)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToHarvestLog(data as HarvestLogRow);
}

export async function deleteHarvestLog(id: string | number): Promise<void> {
  const { error } = await supabase
    .from(HARVEST_LOGS_TABLE)
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function loadHarvestReductionTransactions(
  filters?: ListHarvestReductionTransactionsFilters
): Promise<HarvestReductionTransactionRecord[]> {
  // Use `any` here to avoid deep generic instantiation from dynamic env-based column names.
  let query: any = supabase
    .from(HARVEST_REDUCTION_TRANSACTIONS_TABLE)
    .select("*")
    .order("created_at", { ascending: filters?.ascending ?? false });

  if (typeof filters?.harvestId === "number") query = query.eq("harvest_id", filters.harvestId);
  if (typeof filters?.harvestLogId === "number") query = query.eq("harvest_log_id", filters.harvestLogId);
  if (typeof filters?.reductionType === "string") query = query.eq(HARVEST_REDUCTION_TYPE_COLUMN, filters.reductionType);
  if (typeof filters?.createdFrom === "string") query = query.gte("created_at", filters.createdFrom);
  if (typeof filters?.createdTo === "string") query = query.lte("created_at", filters.createdTo);
  if (typeof filters?.limit === "number") query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;

  return (data as HarvestReductionTransactionRow[]).map(mapRowToHarvestReductionTransaction);
}

export async function loadHarvestReductionTransactionsByHarvestId(
  harvestId: number
): Promise<HarvestReductionTransactionRecord[]> {
  return loadHarvestReductionTransactions({ harvestId });
}

export async function loadHarvestReductionTransactionsByHarvestLogId(
  harvestLogId: number
): Promise<HarvestReductionTransactionRecord[]> {
  return loadHarvestReductionTransactions({ harvestLogId });
}

export async function addHarvestReductionTransaction(
  input: CreateHarvestReductionTransactionInput
): Promise<HarvestReductionTransactionRecord> {
  const payload: Record<string, string | number | null> = {
    harvest_id: input.harvestId,
    harvest_log_id: input.harvestLogId,
    remarks: input.remarks?.trim() || null,
  };
  payload[HARVEST_REDUCTION_ANIMAL_COUNT_COLUMN] = toNonNegativeInt(input.animalCount);
  payload[HARVEST_REDUCTION_TYPE_COLUMN] = input.reductionType;

  const { data, error } = await supabase
    .from(HARVEST_REDUCTION_TRANSACTIONS_TABLE)
    .insert([payload])
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToHarvestReductionTransaction(data as HarvestReductionTransactionRow);
}

export async function updateHarvestReductionTransaction(
  id: string | number,
  input: UpdateHarvestReductionTransactionInput
): Promise<HarvestReductionTransactionRecord> {
  const payload: Record<string, string | number | null> = {};

  if ("harvestId" in input) payload.harvest_id = input.harvestId ?? null;
  if ("harvestLogId" in input) payload.harvest_log_id = input.harvestLogId ?? null;
  if ("remarks" in input) payload.remarks = input.remarks?.trim() || null;
  if ("animalCount" in input) payload[HARVEST_REDUCTION_ANIMAL_COUNT_COLUMN] = toNonNegativeInt(input.animalCount);
  if ("reductionType" in input) payload[HARVEST_REDUCTION_TYPE_COLUMN] = input.reductionType ?? null;

  const { data, error } = await supabase
    .from(HARVEST_REDUCTION_TRANSACTIONS_TABLE)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToHarvestReductionTransaction(data as HarvestReductionTransactionRow);
}

export async function deleteHarvestReductionTransaction(id: string | number): Promise<void> {
  const { error } = await supabase
    .from(HARVEST_REDUCTION_TRANSACTIONS_TABLE)
    .delete()
    .eq("id", id);

  if (error) throw error;
}
