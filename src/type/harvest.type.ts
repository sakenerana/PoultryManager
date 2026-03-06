export type Int8 = number;
export type Float8 = number;
export type Timestamp = string;

export type HarvestRow = {
  id: Int8 | string;
  created_at: Timestamp;
  building_id: Int8 | null;
  grow_id: Int8 | null;
  status: string | null;
  total_animals_out?: Int8 | null;
  total_animals_?: Int8 | null;
  total_animals?: Int8 | null;
  [key: string]: unknown;
};

export type HarvestRecord = {
  id: string;
  createdAt: Timestamp;
  buildingId: Int8 | null;
  growId: Int8 | null;
  status: string | null;
  totalAnimals: Int8;
};

export type CreateHarvestInput = {
  buildingId: Int8;
  growId?: Int8 | null;
  totalAnimals: Int8;
  status?: string | null;
};

export type UpdateHarvestInput = Partial<
  Pick<HarvestRecord, "buildingId" | "growId" | "totalAnimals" | "status">
>;

export type ListHarvestFilters = {
  buildingId?: Int8;
  growId?: Int8;
  status?: string;
  createdFrom?: Timestamp;
  createdTo?: Timestamp;
  ascending?: boolean;
  limit?: number;
};

export type HarvestTruckRow = {
  id: Int8 | string;
  created_at: Timestamp;
  harvest_id: Int8 | null;
  name: string | null;
  plate_no: string | null;
  weight_no_load?: Float8 | null;
  weight_no_lo?: Float8 | null;
  weight_with_load?: Float8 | null;
  weight_with_l?: Float8 | null;
  animals_loaded?: Float8 | null;
  animals_loade?: Float8 | null;
  status: string | null;
  [key: string]: unknown;
};

export type HarvestTruckRecord = {
  id: string;
  createdAt: Timestamp;
  harvestId: Int8 | null;
  name: string;
  plateNo: string;
  weightNoLoad: Float8;
  weightWithLoad: Float8;
  animalsLoaded: Float8;
  status: string | null;
};

export type CreateHarvestTruckInput = {
  harvestId?: Int8 | null;
  name?: string | null;
  plateNo?: string | null;
  weightNoLoad?: Float8 | null;
  weightWithLoad?: Float8 | null;
  animalsLoaded?: Float8 | null;
  status?: string | null;
};

export type UpdateHarvestTruckInput = Partial<
  Pick<
    HarvestTruckRecord,
    "harvestId" | "name" | "plateNo" | "weightNoLoad" | "weightWithLoad" | "animalsLoaded" | "status"
  >
>;

export type ListHarvestTrucksFilters = {
  harvestId?: Int8;
  status?: string;
  createdFrom?: Timestamp;
  createdTo?: Timestamp;
  ascending?: boolean;
  limit?: number;
};

