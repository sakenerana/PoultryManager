type BodyWeightValueSource = {
  avgWeight?: unknown;
  avg_weight?: unknown;
  frontWeight?: unknown;
  front_weight?: unknown;
  middleWeight?: unknown;
  middle_weight?: unknown;
  backWeight?: unknown;
  back_weight?: unknown;
};

const toPositiveWeightArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((n) => Number.isFinite(n) && n > 0);
};

export const resolveBodyWeightAverage = (row: BodyWeightValueSource): number | null => {
  const directAvg = Number(row.avgWeight ?? row.avg_weight);
  if (Number.isFinite(directAvg) && directAvg > 0) {
    return directAvg;
  }

  const frontWeights = toPositiveWeightArray(row.frontWeight ?? row.front_weight);
  const middleWeights = toPositiveWeightArray(row.middleWeight ?? row.middle_weight);
  const backWeights = toPositiveWeightArray(row.backWeight ?? row.back_weight);
  const totalChicken = frontWeights.length + middleWeights.length + backWeights.length;

  if (totalChicken === 0) {
    return null;
  }

  const totalWeight =
    frontWeights.reduce((sum, value) => sum + value, 0) +
    middleWeights.reduce((sum, value) => sum + value, 0) +
    backWeights.reduce((sum, value) => sum + value, 0);

  return totalWeight / totalChicken;
};
