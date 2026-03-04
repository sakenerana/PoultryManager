import supabase from "../utils/supabase";
import type { BuildingRecord, CreateBuildingInput, UpdateBuildingInput } from "../type/building.type";

const BUILDINGS_TABLE = import.meta.env.VITE_SUPABASE_BUILDINGS_TABLE ?? "Buildings";

type BuildingRow = {
  id: string | number;
  name: string | null;
  created_at: string;
};

function mapRowToBuilding(row: BuildingRow): BuildingRecord {
  return {
    id: String(row.id),
    name: row.name ?? "",
    createdAt: row.created_at,
  };
}

export async function loadBuildings(): Promise<BuildingRecord[]> {
  const { data, error } = await supabase
    .from(BUILDINGS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as BuildingRow[]).map(mapRowToBuilding);
}

export async function loadBuildingsByDate(date: string): Promise<BuildingRecord[]> {
  const startDate = new Date(`${date}T00:00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);

  const start = startDate.toISOString();
  const end = endDate.toISOString();

  const { data, error } = await supabase
    .from(BUILDINGS_TABLE)
    .select("*")
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as BuildingRow[]).map(mapRowToBuilding);
}

export async function addBuilding(input: CreateBuildingInput): Promise<BuildingRecord> {
  const trimmedName = input.name.trim();

  const { data, error } = await supabase
    .from(BUILDINGS_TABLE)
    .insert([{ name: trimmedName }])
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToBuilding(data as BuildingRow);
}

export async function updateBuilding(buildingId: string, input: UpdateBuildingInput): Promise<BuildingRecord> {
  const payload: Record<string, string> = {};
  if (typeof input.name === "string") payload.name = input.name.trim();

  const { data, error } = await supabase
    .from(BUILDINGS_TABLE)
    .update(payload)
    .eq("id", buildingId)
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToBuilding(data as BuildingRow);
}

export async function deleteBuilding(buildingId: string): Promise<void> {
  const { error } = await supabase
    .from(BUILDINGS_TABLE)
    .delete()
    .eq("id", buildingId);

  if (error) throw error;
}
