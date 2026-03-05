export type Int8 = number;
export type Float8 = number;
export type Timestamp = string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type BodyWeightRow = {
  id: Int8;
  created_at: Timestamp;
  building_id: Int8 | null;
  subbuilding_id: Int8 | null;
  avg_weight: Float8 | null;
  front_weight: JsonValue | null;
  middle_weight: JsonValue | null;
  back_weight: JsonValue | null;
  grow_id: Int8 | null;
};

export type BodyWeightRecord = {
  id: string;
  createdAt: Timestamp;
  buildingId: Int8 | null;
  subbuildingId: Int8 | null;
  avgWeight: Float8 | null;
  frontWeight: JsonValue | null;
  middleWeight: JsonValue | null;
  backWeight: JsonValue | null;
  growId: Int8 | null;
};

export type CreateBodyWeightInput = {
  buildingId: Int8;
  subbuildingId: Int8;
  avgWeight?: Float8 | null;
  frontWeight?: JsonValue | null;
  middleWeight?: JsonValue | null;
  backWeight?: JsonValue | null;
  growId?: Int8 | null;
};

export type UpdateBodyWeightInput = Partial<
  Pick<
    BodyWeightRecord,
    "buildingId" | "subbuildingId" | "avgWeight" | "frontWeight" | "middleWeight" | "backWeight" | "growId"
  >
>;

export type ListBodyWeightFilters = {
  buildingId?: Int8;
  subbuildingId?: Int8;
  growId?: Int8;
  createdFrom?: Timestamp;
  createdTo?: Timestamp;
  ascending?: boolean;
  limit?: number;
};
