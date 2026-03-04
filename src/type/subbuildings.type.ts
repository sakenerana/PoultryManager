export type SubBuildingRecord = {
  id: string;
  buildingId: number | null;
  name: string;
  createdAt: string;
};

export type CreateSubBuildingInput = {
  buildingId: number;
  name: string;
};

export type UpdateSubBuildingInput = Partial<Pick<SubBuildingRecord, "buildingId" | "name">>;
