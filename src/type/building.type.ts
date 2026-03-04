export type BuildingRecord = {
  id: string;
  name: string;
  createdAt: string;
};

export type CreateBuildingInput = {
  name: string;
};

export type UpdateBuildingInput = Partial<Pick<BuildingRecord, "name">>;
