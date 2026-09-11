import dayjs from "dayjs";

type GrowSequenceInput = {
  id: number;
  createdAt?: string | null;
  created_at?: string | null;
};

type BuildingGrowSequenceInput = GrowSequenceInput & {
  buildingId: number;
};

const getCreatedAt = (grow: GrowSequenceInput): string | null | undefined =>
  grow.createdAt ?? grow.created_at;

const compareGrowStart = (a: GrowSequenceInput, b: GrowSequenceInput): number => {
  const aDate = dayjs(getCreatedAt(a));
  const bDate = dayjs(getCreatedAt(b));
  const aTime = aDate.isValid() ? aDate.valueOf() : 0;
  const bTime = bDate.isValid() ? bDate.valueOf() : 0;
  return aTime - bTime || a.id - b.id;
};

export const createGrowSequenceMap = <T extends GrowSequenceInput>(grows: T[]): Map<number, number> =>
  new Map(
    [...grows]
      .sort(compareGrowStart)
      .map((grow, index) => [grow.id, index + 1])
  );

export const createGrowSequenceMapByBuilding = <T extends BuildingGrowSequenceInput>(grows: T[]): Map<number, number> => {
  const growSequenceById = new Map<number, number>();
  const growsByBuildingId = new Map<number, T[]>();

  grows.forEach((grow) => {
    const buildingGrows = growsByBuildingId.get(grow.buildingId) ?? [];
    buildingGrows.push(grow);
    growsByBuildingId.set(grow.buildingId, buildingGrows);
  });

  growsByBuildingId.forEach((buildingGrows) => {
    createGrowSequenceMap(buildingGrows).forEach((sequenceNumber, growId) => {
      growSequenceById.set(growId, sequenceNumber);
    });
  });

  return growSequenceById;
};

export const withGrowSequenceNumbers = <T extends GrowSequenceInput>(
  grows: T[],
  sequenceByGrowId = createGrowSequenceMap(grows)
): Array<T & { sequenceNumber: number }> =>
  grows.map((grow) => ({
    ...grow,
    sequenceNumber: sequenceByGrowId.get(grow.id) ?? 0,
  }));

export const formatGrowSequenceNumber = (
  sequenceNumber: number | null | undefined,
  fallback = "-"
): string => (sequenceNumber != null && sequenceNumber > 0 ? `#${sequenceNumber}` : fallback);

export const formatGrowLabel = (
  sequenceNumber: number | null | undefined,
  fallback = "-"
): string => `Grow ${formatGrowSequenceNumber(sequenceNumber, fallback)}`;
