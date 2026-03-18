import supabase from "../utils/supabase";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import type {
  BodyWeightRecord,
  BodyWeightRow,
  CreateBodyWeightInput,
  ListBodyWeightFilters,
  UpdateBodyWeightInput,
} from "../type/bodyWeight.types";

const BODY_WEIGHT_TABLE = import.meta.env.VITE_SUPABASE_BODY_WEIGHT_LOGS_TABLE ?? "BodyWeightLogs";

dayjs.extend(utc);

function mapRowToBodyWeight(row: BodyWeightRow): BodyWeightRecord {
  return {
    id: String(row.id),
    createdAt: row.created_at,
    buildingId: row.building_id,
    subbuildingId: row.subbuilding_id,
    avgWeight: row.avg_weight,
    frontWeight: row.front_weight,
    middleWeight: row.middle_weight,
    backWeight: row.back_weight,
    growId: row.grow_id,
  };
}

export async function listBodyWeightLogs(
  filters?: ListBodyWeightFilters
): Promise<BodyWeightRecord[]> {
  let query = supabase
    .from(BODY_WEIGHT_TABLE)
    .select("*")
    .order("created_at", { ascending: filters?.ascending ?? false });

  if (typeof filters?.buildingId === "number") query = query.eq("building_id", filters.buildingId);
  if (typeof filters?.subbuildingId === "number") query = query.eq("subbuilding_id", filters.subbuildingId);
  if (typeof filters?.growId === "number") query = query.eq("grow_id", filters.growId);
  if (typeof filters?.createdFrom === "string") query = query.gte("created_at", filters.createdFrom);
  if (typeof filters?.createdTo === "string") query = query.lte("created_at", filters.createdTo);
  if (typeof filters?.limit === "number") query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data as BodyWeightRow[]).map(mapRowToBodyWeight);
}

export async function loadBodyWeightLogsByBuildingId(buildingId: number): Promise<BodyWeightRecord[]> {
  return listBodyWeightLogs({ buildingId });
}

export async function loadBodyWeightLogsByBuildingIdAndDate(
  buildingId: number,
  date: string
): Promise<BodyWeightRecord[]> {
  const startDate = dayjs.utc(date, "YYYY-MM-DD").startOf("day").toISOString();
  const endDate = dayjs.utc(date, "YYYY-MM-DD").add(1, "day").startOf("day").subtract(1, "millisecond").toISOString();

  return listBodyWeightLogs({
    buildingId,
    createdFrom: startDate,
    createdTo: endDate,
    ascending: true,
  });
}

export async function getBodyWeightLogById(id: string | number): Promise<BodyWeightRecord> {
  const { data, error } = await supabase
    .from(BODY_WEIGHT_TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return mapRowToBodyWeight(data as BodyWeightRow);
}

export async function addBodyWeightLog(input: CreateBodyWeightInput): Promise<BodyWeightRecord> {
  const payload = {
    building_id: input.buildingId,
    subbuilding_id: input.subbuildingId,
    avg_weight: input.avgWeight ?? null,
    front_weight: input.frontWeight ?? null,
    middle_weight: input.middleWeight ?? null,
    back_weight: input.backWeight ?? null,
    grow_id: input.growId ?? null,
    created_at: input.createdAt ?? undefined,
  };

  const { data, error } = await supabase
    .from(BODY_WEIGHT_TABLE)
    .insert([payload])
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToBodyWeight(data as BodyWeightRow);
}

export async function updateBodyWeightLog(
  id: string | number,
  input: UpdateBodyWeightInput
): Promise<BodyWeightRecord> {
  const payload: Record<string, unknown> = {};
  if ("buildingId" in input) payload.building_id = input.buildingId ?? null;
  if ("subbuildingId" in input) payload.subbuilding_id = input.subbuildingId ?? null;
  if ("avgWeight" in input) payload.avg_weight = input.avgWeight ?? null;
  if ("frontWeight" in input) payload.front_weight = input.frontWeight ?? null;
  if ("middleWeight" in input) payload.middle_weight = input.middleWeight ?? null;
  if ("backWeight" in input) payload.back_weight = input.backWeight ?? null;
  if ("growId" in input) payload.grow_id = input.growId ?? null;
  if ("createdAt" in input) payload.created_at = input.createdAt ?? null;

  const { data, error } = await supabase
    .from(BODY_WEIGHT_TABLE)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToBodyWeight(data as BodyWeightRow);
}

export async function deleteBodyWeightLog(id: string | number): Promise<void> {
  const { error } = await supabase
    .from(BODY_WEIGHT_TABLE)
    .delete()
    .eq("id", id);

  if (error) throw error;
}
