import supabase from "../utils/supabase";
import type {
  CreateHarvestInput,
  CreateHarvestTruckInput,
  HarvestRecord,
  HarvestRow,
  HarvestTruckRecord,
  HarvestTruckRow,
  ListHarvestFilters,
  ListHarvestTrucksFilters,
  UpdateHarvestInput,
  UpdateHarvestTruckInput,
} from "../type/harvest.type";

const HARVEST_TABLE = import.meta.env.VITE_SUPABASE_HARVEST_TABLE ?? "Harvest";
const HARVEST_TRUCKS_TABLE = import.meta.env.VITE_SUPABASE_HARVEST_TRUCKS_TABLE ?? "HarvestTrucks";

const HARVEST_TOTAL_ANIMALS_COLUMN =
  import.meta.env.VITE_SUPABASE_HARVEST_TOTAL_ANIMALS_COLUMN ?? "total_animals_out";

const HARVEST_TRUCK_WEIGHT_NO_LOAD_COLUMN =
  import.meta.env.VITE_SUPABASE_HARVEST_TRUCK_WEIGHT_NO_LOAD_COLUMN ?? "weight_no_load";
const HARVEST_TRUCK_WEIGHT_WITH_LOAD_COLUMN =
  import.meta.env.VITE_SUPABASE_HARVEST_TRUCK_WEIGHT_WITH_LOAD_COLUMN ?? "weight_with_load";
const HARVEST_TRUCK_ANIMALS_LOADED_COLUMN =
  import.meta.env.VITE_SUPABASE_HARVEST_TRUCK_ANIMALS_LOADED_COLUMN ?? "animals_loaded";

function toNumber(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function getTotalAnimals(row: HarvestRow): number {
  const rawFromConfigured = row[HARVEST_TOTAL_ANIMALS_COLUMN];
  const raw =
    typeof rawFromConfigured === "number" || rawFromConfigured === null
      ? rawFromConfigured
      : (row.total_animals_out ?? row.total_animals_ ?? row.total_animals ?? null);

  return Math.max(0, Math.floor(Number(raw ?? 0)));
}

function mapRowToHarvest(row: HarvestRow): HarvestRecord {
  return {
    id: String(row.id),
    createdAt: row.created_at,
    buildingId: row.building_id,
    growId: row.grow_id,
    status: row.status,
    totalAnimals: getTotalAnimals(row),
  };
}

function getWeightNoLoad(row: HarvestTruckRow): number {
  const configured = row[HARVEST_TRUCK_WEIGHT_NO_LOAD_COLUMN];
  const raw =
    typeof configured === "number" || configured === null
      ? configured
      : (row.weight_no_lo ?? row.weight_no_load ?? null);
  return Math.max(0, toNumber(raw));
}

function getWeightWithLoad(row: HarvestTruckRow): number {
  const configured = row[HARVEST_TRUCK_WEIGHT_WITH_LOAD_COLUMN];
  const raw =
    typeof configured === "number" || configured === null
      ? configured
      : (row.weight_with_l ?? row.weight_with_load ?? null);
  return Math.max(0, toNumber(raw));
}

function getAnimalsLoaded(row: HarvestTruckRow): number {
  const configured = row[HARVEST_TRUCK_ANIMALS_LOADED_COLUMN];
  const raw =
    typeof configured === "number" || configured === null
      ? configured
      : (row.animals_loade ?? row.animals_loaded ?? null);
  return Math.max(0, toNumber(raw));
}

function mapRowToHarvestTruck(row: HarvestTruckRow): HarvestTruckRecord {
  return {
    id: String(row.id),
    createdAt: row.created_at,
    harvestId: row.harvest_id,
    name: row.name ?? "",
    plateNo: row.plate_no ?? "",
    weightNoLoad: getWeightNoLoad(row),
    weightWithLoad: getWeightWithLoad(row),
    animalsLoaded: getAnimalsLoaded(row),
    status: row.status,
  };
}

export async function loadHarvests(filters?: ListHarvestFilters): Promise<HarvestRecord[]> {
  let query = supabase
    .from(HARVEST_TABLE)
    .select("*")
    .order("created_at", { ascending: filters?.ascending ?? false });

  if (typeof filters?.buildingId === "number") query = query.eq("building_id", filters.buildingId);
  if (typeof filters?.growId === "number") query = query.eq("grow_id", filters.growId);
  if (typeof filters?.status === "string") query = query.eq("status", filters.status);
  if (typeof filters?.createdFrom === "string") query = query.gte("created_at", filters.createdFrom);
  if (typeof filters?.createdTo === "string") query = query.lte("created_at", filters.createdTo);
  if (typeof filters?.limit === "number") query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;

  return (data as HarvestRow[]).map(mapRowToHarvest);
}

export async function loadHarvestsByDate(date: string): Promise<HarvestRecord[]> {
  const startDate = new Date(`${date}T00:00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);

  return loadHarvests({
    createdFrom: startDate.toISOString(),
    createdTo: endDate.toISOString(),
  });
}

export async function loadHarvestsByBuildingAndDate(
  buildingId: number,
  date: string
): Promise<HarvestRecord[]> {
  const startDate = new Date(`${date}T00:00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);

  return loadHarvests({
    buildingId,
    createdFrom: startDate.toISOString(),
    createdTo: endDate.toISOString(),
  });
}

export async function getHarvestById(id: string | number): Promise<HarvestRecord> {
  const { data, error } = await supabase
    .from(HARVEST_TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return mapRowToHarvest(data as HarvestRow);
}

export async function addHarvest(input: CreateHarvestInput): Promise<HarvestRecord> {
  const payload: Record<string, string | number | null> = {
    building_id: input.buildingId,
    grow_id: input.growId ?? null,
    status: input.status?.trim() || null,
  };
  payload[HARVEST_TOTAL_ANIMALS_COLUMN] = Math.max(0, Math.floor(Number(input.totalAnimals || 0)));

  const { data, error } = await supabase
    .from(HARVEST_TABLE)
    .insert([payload])
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToHarvest(data as HarvestRow);
}

export async function updateHarvest(id: string | number, input: UpdateHarvestInput): Promise<HarvestRecord> {
  const payload: Record<string, string | number | null> = {};

  if ("buildingId" in input) payload.building_id = input.buildingId ?? null;
  if ("growId" in input) payload.grow_id = input.growId ?? null;
  if ("status" in input) payload.status = input.status?.trim() || null;
  if ("totalAnimals" in input) {
    payload[HARVEST_TOTAL_ANIMALS_COLUMN] = Math.max(0, Math.floor(Number(input.totalAnimals ?? 0)));
  }

  const { data, error } = await supabase
    .from(HARVEST_TABLE)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToHarvest(data as HarvestRow);
}

export async function deleteHarvest(id: string | number): Promise<void> {
  const { error } = await supabase
    .from(HARVEST_TABLE)
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function loadHarvestTrucks(filters?: ListHarvestTrucksFilters): Promise<HarvestTruckRecord[]> {
  let query = supabase
    .from(HARVEST_TRUCKS_TABLE)
    .select("*")
    .order("created_at", { ascending: filters?.ascending ?? false });

  if (typeof filters?.harvestId === "number") query = query.eq("harvest_id", filters.harvestId);
  if (typeof filters?.status === "string") query = query.eq("status", filters.status);
  if (typeof filters?.createdFrom === "string") query = query.gte("created_at", filters.createdFrom);
  if (typeof filters?.createdTo === "string") query = query.lte("created_at", filters.createdTo);
  if (typeof filters?.limit === "number") query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;

  return (data as HarvestTruckRow[]).map(mapRowToHarvestTruck);
}

export async function loadHarvestTrucksByHarvestId(harvestId: number): Promise<HarvestTruckRecord[]> {
  return loadHarvestTrucks({ harvestId });
}

export async function addHarvestTruck(input: CreateHarvestTruckInput): Promise<HarvestTruckRecord> {
  const payload: Record<string, string | number | null> = {
    harvest_id: input.harvestId ?? null,
    name: input.name?.trim() || null,
    plate_no: input.plateNo?.trim() || null,
    status: input.status?.trim() || null,
  };

  payload[HARVEST_TRUCK_WEIGHT_NO_LOAD_COLUMN] = Math.max(0, toNumber(input.weightNoLoad ?? 0));
  payload[HARVEST_TRUCK_WEIGHT_WITH_LOAD_COLUMN] = Math.max(0, toNumber(input.weightWithLoad ?? 0));
  payload[HARVEST_TRUCK_ANIMALS_LOADED_COLUMN] = Math.max(0, toNumber(input.animalsLoaded ?? 0));

  const { data, error } = await supabase
    .from(HARVEST_TRUCKS_TABLE)
    .insert([payload])
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToHarvestTruck(data as HarvestTruckRow);
}

export async function updateHarvestTruck(
  id: string | number,
  input: UpdateHarvestTruckInput
): Promise<HarvestTruckRecord> {
  const payload: Record<string, string | number | null> = {};

  if ("harvestId" in input) payload.harvest_id = input.harvestId ?? null;
  if ("name" in input) payload.name = input.name?.trim() || null;
  if ("plateNo" in input) payload.plate_no = input.plateNo?.trim() || null;
  if ("status" in input) payload.status = input.status?.trim() || null;
  if ("weightNoLoad" in input) {
    payload[HARVEST_TRUCK_WEIGHT_NO_LOAD_COLUMN] = Math.max(0, toNumber(input.weightNoLoad ?? 0));
  }
  if ("weightWithLoad" in input) {
    payload[HARVEST_TRUCK_WEIGHT_WITH_LOAD_COLUMN] = Math.max(0, toNumber(input.weightWithLoad ?? 0));
  }
  if ("animalsLoaded" in input) {
    payload[HARVEST_TRUCK_ANIMALS_LOADED_COLUMN] = Math.max(0, toNumber(input.animalsLoaded ?? 0));
  }

  const { data, error } = await supabase
    .from(HARVEST_TRUCKS_TABLE)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToHarvestTruck(data as HarvestTruckRow);
}

export async function deleteHarvestTruck(id: string | number): Promise<void> {
  const { error } = await supabase
    .from(HARVEST_TRUCKS_TABLE)
    .delete()
    .eq("id", id);

  if (error) throw error;
}
