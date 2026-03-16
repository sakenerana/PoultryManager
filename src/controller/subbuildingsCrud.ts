import supabase from "../utils/supabase";
import type {
  CreateSubBuildingInput,
  SubBuildingRecord,
  UpdateSubBuildingInput,
} from "../type/subbuildings.type";

const SUBBUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_SUBBUILDINGS_TABLE ?? "Subbuildings";

type SubBuildingRow = {
  id: string | number;
  created_at: string;
  building_id: number | null;
  name: string | null;
};

function mapRowToSubBuilding(row: SubBuildingRow): SubBuildingRecord {
  return {
    id: String(row.id),
    createdAt: row.created_at,
    buildingId: row.building_id ?? null,
    name: row.name ?? "",
  };
}

export async function loadSubBuildings(): Promise<SubBuildingRecord[]> {
  const { data, error } = await supabase
    .from(SUBBUILDINGS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as SubBuildingRow[]).map(mapRowToSubBuilding);
}

export async function loadSubBuildingsByBuildingId(buildingId: number): Promise<SubBuildingRecord[]> {
  const { data, error } = await supabase
    .from(SUBBUILDINGS_TABLE)
    .select("*")
    .eq("building_id", buildingId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as SubBuildingRow[]).map(mapRowToSubBuilding);
}

export async function loadSubBuildingsByBuildingIdAndDate(
  buildingId: number,
  date: string
): Promise<SubBuildingRecord[]> {
  const startDate = new Date(`${date}T00:00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);

  const start = startDate.toISOString();
  const end = endDate.toISOString();

  const { data, error } = await supabase
    .from(SUBBUILDINGS_TABLE)
    .select("*")
    .eq("building_id", buildingId)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as SubBuildingRow[]).map(mapRowToSubBuilding);
}

export async function addSubBuilding(input: CreateSubBuildingInput): Promise<SubBuildingRecord> {
  const payload = {
    building_id: input.buildingId,
    name: input.name.trim(),
  };

  const { data, error } = await supabase
    .from(SUBBUILDINGS_TABLE)
    .insert([payload])
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToSubBuilding(data as SubBuildingRow);
}

export async function addSubBuildings(inputs: CreateSubBuildingInput[]): Promise<SubBuildingRecord[]> {
  const payload = inputs.map((input) => ({
    building_id: input.buildingId,
    name: input.name.trim(),
  }));

  const { data, error } = await supabase
    .from(SUBBUILDINGS_TABLE)
    .insert(payload)
    .select("*");

  if (error) throw error;
  return (data as SubBuildingRow[]).map(mapRowToSubBuilding);
}

export async function updateSubBuilding(
  subBuildingId: string,
  input: UpdateSubBuildingInput
): Promise<SubBuildingRecord> {
  const payload: Record<string, string | number | null> = {};
  if (typeof input.name === "string") payload.name = input.name.trim();
  if ("buildingId" in input) payload.building_id = input.buildingId ?? null;

  const { data, error } = await supabase
    .from(SUBBUILDINGS_TABLE)
    .update(payload)
    .eq("id", subBuildingId)
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToSubBuilding(data as SubBuildingRow);
}

export async function deleteSubBuilding(subBuildingId: string): Promise<void> {
  const { error } = await supabase
    .from(SUBBUILDINGS_TABLE)
    .delete()
    .eq("id", subBuildingId);

  if (error) throw error;
}
