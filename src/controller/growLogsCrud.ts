import supabase from "../utils/supabase";
import type {
  CreateGrowLogInput,
  CreateGrowReductionBundleInput,
  CreateGrowReductionTransactionInput,
  GrowLogRecord,
  GrowLogRow,
  GrowReductionTransactionRecord,
  GrowReductionTransactionRow,
  UpdateGrowLogInput,
  UpdateGrowReductionTransactionInput,
} from "../type/growLogs.type";

const GROW_LOGS_TABLE = import.meta.env.VITE_SUPABASE_GROW_LOGS_TABLE ?? "GrowLogs";
const GROW_REDUCTION_TRANSACTIONS_TABLE =
  import.meta.env.VITE_SUPABASE_GROW_REDUCTION_TRANSACTIONS_TABLE ?? "GrowReductionTransactions";

// Optional column override for DBs that use a different name.
const REDUCTION_ANIMAL_COUNT_COLUMN =
  import.meta.env.VITE_SUPABASE_REDUCTION_ANIMAL_COUNT_COLUMN ?? "animal_count_to_deduct";

function mapRowToGrowLog(row: GrowLogRow): GrowLogRecord {
  return {
    id: String(row.id),
    createdAt: row.created_at,
    growId: row.grow_id,
    subbuildingId: row.subbuilding_id,
    actualTotalAnimals: row.actual_total_animals,
    mortality: row.mortality,
    thinning: row.thinning,
    takeOut: row.take_out,
  };
}

function mapRowToGrowReductionTransaction(
  row: GrowReductionTransactionRow
): GrowReductionTransactionRecord {
  return {
    id: String(row.id),
    createdAt: row.created_at,
    buildingId: row.building_id,
    subbuildingId: row.subbuilding_id,
    growId: row.grow_id,
    growLogId: row.grow_log_id,
    animalCount: row.animal_count_to_deduct ?? row.animal_count ?? null,
    reductionType: row.reduction_type,
    remarks: row.remarks,
  };
}

export async function addGrowLog(input: CreateGrowLogInput): Promise<GrowLogRecord> {
  const payload = {
    grow_id: input.growId,
    subbuilding_id: input.subbuildingId ?? null,
    actual_total_animals: input.actualTotalAnimals ?? null,
    mortality: input.mortality ?? null,
    thinning: input.thinning ?? null,
    take_out: input.takeOut ?? null,
  };

  const { data, error } = await supabase
    .from(GROW_LOGS_TABLE)
    .insert([payload])
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToGrowLog(data as GrowLogRow);
}

export async function updateGrowLog(
  id: string | number,
  input: UpdateGrowLogInput
): Promise<GrowLogRecord> {
  const payload: Record<string, unknown> = {};
  if ("growId" in input) payload.grow_id = input.growId ?? null;
  if ("subbuildingId" in input) payload.subbuilding_id = input.subbuildingId ?? null;
  if ("actualTotalAnimals" in input) payload.actual_total_animals = input.actualTotalAnimals ?? null;
  if ("mortality" in input) payload.mortality = input.mortality ?? null;
  if ("thinning" in input) payload.thinning = input.thinning ?? null;
  if ("takeOut" in input) payload.take_out = input.takeOut ?? null;

  const { data, error } = await supabase
    .from(GROW_LOGS_TABLE)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToGrowLog(data as GrowLogRow);
}

export async function loadGrowLogsByGrowId(growId: number): Promise<GrowLogRecord[]> {
  const { data, error } = await supabase
    .from(GROW_LOGS_TABLE)
    .select("*")
    .eq("grow_id", growId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as GrowLogRow[]).map(mapRowToGrowLog);
}

export async function addGrowReductionTransaction(
  input: CreateGrowReductionTransactionInput
): Promise<GrowReductionTransactionRecord> {
  const payload: Record<string, unknown> = {
    building_id: input.buildingId,
    subbuilding_id: input.subbuildingId,
    grow_id: input.growId,
    grow_log_id: input.growLogId,
    reduction_type: input.reductionType,
    remarks: input.remarks ?? null,
  };
  payload[REDUCTION_ANIMAL_COUNT_COLUMN] = input.animalCount;

  const { data, error } = await supabase
    .from(GROW_REDUCTION_TRANSACTIONS_TABLE)
    .insert([payload])
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToGrowReductionTransaction(data as GrowReductionTransactionRow);
}

export async function updateGrowReductionTransaction(
  id: string | number,
  input: UpdateGrowReductionTransactionInput
): Promise<GrowReductionTransactionRecord> {
  const payload: Record<string, unknown> = {};
  if ("buildingId" in input) payload.building_id = input.buildingId ?? null;
  if ("subbuildingId" in input) payload.subbuilding_id = input.subbuildingId ?? null;
  if ("growId" in input) payload.grow_id = input.growId ?? null;
  if ("growLogId" in input) payload.grow_log_id = input.growLogId ?? null;
  if ("animalCount" in input) payload[REDUCTION_ANIMAL_COUNT_COLUMN] = input.animalCount ?? null;
  if ("reductionType" in input) payload.reduction_type = input.reductionType ?? null;
  if ("remarks" in input) payload.remarks = input.remarks ?? null;

  const { data, error } = await supabase
    .from(GROW_REDUCTION_TRANSACTIONS_TABLE)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToGrowReductionTransaction(data as GrowReductionTransactionRow);
}

export async function loadGrowReductionTransactionsByGrowId(
  growId: number
): Promise<GrowReductionTransactionRecord[]> {
  const { data, error } = await supabase
    .from(GROW_REDUCTION_TRANSACTIONS_TABLE)
    .select("*")
    .eq("grow_id", growId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as GrowReductionTransactionRow[]).map(mapRowToGrowReductionTransaction);
}

export async function createGrowReductionBundle(input: CreateGrowReductionBundleInput): Promise<{
  growLog: GrowLogRecord;
  reductionTransaction: GrowReductionTransactionRecord;
}> {
  let createdGrowLogId: string | null = null;
  try {
    const growLog = await addGrowLog(input.growLog);
    createdGrowLogId = growLog.id;

    const reductionTransaction = await addGrowReductionTransaction({
      buildingId: input.reduction.buildingId,
      subbuildingId: input.reduction.subbuildingId,
      growId: input.reduction.growId ?? input.growLog.growId,
      growLogId: Number(growLog.id),
      animalCount: input.reduction.animalCount,
      reductionType: input.reduction.reductionType,
      remarks: input.reduction.remarks ?? null,
    });

    return { growLog, reductionTransaction };
  } catch (error) {
    // Best effort rollback for non-transactional client flow.
    if (createdGrowLogId !== null) {
      await supabase.from(GROW_LOGS_TABLE).delete().eq("id", createdGrowLogId);
    }
    throw error;
  }
}
