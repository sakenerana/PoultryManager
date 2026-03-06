export type Int8 = number;
export type Timestamp = string;
export type HarvestReductionType = "mortality" | "thinning" | "takeout" | "take_out" | "defect";

export type HarvestLogRow = {
  id: Int8 | string;
  created_at: Timestamp;
  harvest_id: Int8 | null;
  mortality: Int8 | null;
  thinning: Int8 | null;
  takeout: Int8 | null;
  defect: Int8 | null;
};

export type HarvestLogRecord = {
  id: string;
  createdAt: Timestamp;
  harvestId: Int8 | null;
  mortality: Int8;
  thinning: Int8;
  takeOut: Int8;
  defect: Int8;
};

export type CreateHarvestLogInput = {
  harvestId: Int8;
  mortality?: Int8 | null;
  thinning?: Int8 | null;
  takeOut?: Int8 | null;
  defect?: Int8 | null;
};

export type UpdateHarvestLogInput = Partial<
  Pick<HarvestLogRecord, "harvestId" | "mortality" | "thinning" | "takeOut" | "defect">
>;

export type ListHarvestLogsFilters = {
  harvestId?: Int8;
  createdFrom?: Timestamp;
  createdTo?: Timestamp;
  ascending?: boolean;
  limit?: number;
};

export type HarvestReductionTransactionRow = {
  id: Int8 | string;
  created_at: Timestamp;
  harvest_id: Int8 | null;
  harvest_log_id: Int8 | null;
  animal_count_to_deduct?: Int8 | null;
  animal_count?: Int8 | null;
  reduction_type: HarvestReductionType | string | null;
  remarks: string | null;
  [key: string]: unknown;
};

export type HarvestReductionTransactionRecord = {
  id: string;
  createdAt: Timestamp;
  harvestId: Int8 | null;
  harvestLogId: Int8 | null;
  animalCount: Int8;
  reductionType: HarvestReductionType | null;
  remarks: string | null;
};

export type CreateHarvestReductionTransactionInput = {
  harvestId: Int8;
  harvestLogId: Int8;
  animalCount: Int8;
  reductionType: HarvestReductionType;
  remarks?: string | null;
};

export type UpdateHarvestReductionTransactionInput = Partial<
  Pick<
    HarvestReductionTransactionRecord,
    "harvestId" | "harvestLogId" | "animalCount" | "reductionType" | "remarks"
  >
>;

export type ListHarvestReductionTransactionsFilters = {
  harvestId?: Int8;
  harvestLogId?: Int8;
  reductionType?: HarvestReductionType;
  createdFrom?: Timestamp;
  createdTo?: Timestamp;
  ascending?: boolean;
  limit?: number;
};
