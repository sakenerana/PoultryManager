export type Int8 = number;
export type Timestamp = string;

export type ReductionType = "mortality" | "thinning" | "take_out";

export type GrowLogRow = {
  id: Int8;
  created_at: Timestamp;
  grow_id: Int8 | null;
  subbuilding_id: Int8 | null;
  actual_total_animals: Int8 | null;
  mortality: Int8 | null;
  thinning: Int8 | null;
  take_out: Int8 | null;
};

export type GrowReductionTransactionRow = {
  id: Int8;
  created_at: Timestamp;
  building_id: Int8 | null;
  subbuilding_id: Int8 | null;
  grow_id: Int8 | null;
  grow_log_id: Int8 | null;
  animal_count_to_deduct: Int8 | null;
  animal_count?: Int8 | null;
  reduction_type: string | null;
  remarks: string | null;
};

export type GrowLogRecord = {
  id: string;
  createdAt: Timestamp;
  growId: Int8 | null;
  subbuildingId: Int8 | null;
  actualTotalAnimals: Int8 | null;
  mortality: Int8 | null;
  thinning: Int8 | null;
  takeOut: Int8 | null;
};

export type GrowReductionTransactionRecord = {
  id: string;
  createdAt: Timestamp;
  buildingId: Int8 | null;
  subbuildingId: Int8 | null;
  growId: Int8 | null;
  growLogId: Int8 | null;
  animalCount: Int8 | null;
  reductionType: string | null;
  remarks: string | null;
};

export type CreateGrowLogInput = {
  growId: Int8;
  subbuildingId?: Int8 | null;
  actualTotalAnimals?: Int8 | null;
  mortality?: Int8 | null;
  thinning?: Int8 | null;
  takeOut?: Int8 | null;
  createdAt?: Timestamp | null;
};

export type UpdateGrowLogInput = Partial<
  Pick<GrowLogRecord, "growId" | "subbuildingId" | "actualTotalAnimals" | "mortality" | "thinning" | "takeOut" | "createdAt">
>;

export type CreateGrowReductionTransactionInput = {
  buildingId: Int8;
  subbuildingId: Int8;
  growId: Int8;
  growLogId: Int8;
  animalCount: Int8;
  reductionType: ReductionType;
  remarks?: string | null;
  createdAt?: Timestamp | null;
};

export type UpdateGrowReductionTransactionInput = Partial<
  Pick<
    GrowReductionTransactionRecord,
    "buildingId" | "subbuildingId" | "growId" | "growLogId" | "animalCount" | "reductionType" | "remarks" | "createdAt"
  >
>;

export type CreateGrowReductionBundleInput = {
  growLog: CreateGrowLogInput;
  reduction: Omit<CreateGrowReductionTransactionInput, "growLogId" | "growId"> & {
    growId?: Int8;
  };
};
