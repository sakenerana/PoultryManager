export type Int8 = number;
export type Timestamp = string;

// ---------------------------
// Database row models
// ---------------------------

// Table: public."Grows"
// PK: id
// FK: building_id -> public."Buildings".id
export type GrowRow = {
  id: Int8;
  created_at: Timestamp;
  building_id: Int8 | null;
  total_animals: Int8 | null;
  status: string | null;
  is_harvested: boolean | null;
};

// Table: public."Load"
// PK: id
// FK: grow_id -> public."Grows".id
export type LoadRow = {
  id: Int8;
  created_at: Timestamp;
  grow_id: Int8 | null;
  truck_plate_no: string | null;
  status: string | null;
};

// Table: public."LoadTransactions"
// PK: id
// FK: load_id -> public."Load".id
export type LoadTransactionRow = {
  id: Int8;
  created_at: Timestamp;
  load_id: Int8 | null;
  animal_count: Int8 | null;
};

// ---------------------------
// DTOs for inserts/updates
// ---------------------------

export type GrowInsertDto = {
  building_id?: Int8 | null;
  total_animals?: Int8 | null;
  status?: string | null;
  is_harvested?: boolean | null;
};

export type GrowUpdateDto = Partial<GrowInsertDto>;

export type LoadInsertDto = {
  truck_plate_no?: string | null;
  status?: string | null;
};

export type LoadUpdateDto = Partial<LoadInsertDto>;

export type LoadTransactionInsertDto = {
  animal_count?: Int8 | null;
};

export type LoadTransactionUpdateDto = {
  id?: Int8;
  animal_count?: Int8 | null;
};

export type LoadTransactionsPatchDto = {
  // If id exists -> update, otherwise insert
  upsert?: LoadTransactionUpdateDto[];
  // Delete by transaction IDs
  delete_ids?: Int8[];
};

export type CreateGrowPayload = {
  grow: GrowInsertDto;
  load: LoadInsertDto;
  load_transactions: LoadTransactionInsertDto[];
};

export type UpdateGrowPayload = {
  grow?: GrowUpdateDto;
  load?: LoadUpdateDto;
  load_transactions?: LoadTransactionsPatchDto;
};

// ---------------------------
// Query/result models
// ---------------------------

export type LoadWithTransactions = LoadRow & {
  load_transactions: LoadTransactionRow[];
};

export type GrowWithRelations = GrowRow & {
  load: LoadWithTransactions | null;
};

export type ListGrowsFilters = {
  building_id?: Int8;
  status?: string;
  is_harvested?: boolean;
  created_from?: Timestamp;
  created_to?: Timestamp;
  limit?: number;
  offset?: number;
  ascending?: boolean;
};

export type CrudResult<T> = {
  data: T | null;
  error: string | null;
};

