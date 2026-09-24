export const DAILY_FEED_TARGET_GRAMS_PER_BIRD = [
  12, 16, 20, 24, 27, 31, 35, 39, 44, 48,
  52, 57, 62, 67, 72, 77, 83, 88, 94, 100,
  105, 111, 117, 122, 128, 134, 139, 145, 150, 156,
] as const;

export type DailyFeedTarget = {
  ageDay: number;
  gramsPerBird: number;
  birdCount: number;
  targetKg: number;
};

export function getDailyFeedTarget(ageDay: number, birdCount: number): DailyFeedTarget | null {
  const gramsPerBird = DAILY_FEED_TARGET_GRAMS_PER_BIRD[ageDay - 1];
  if (gramsPerBird == null) return null;

  const safeBirdCount = Number.isFinite(birdCount) ? Math.max(0, Math.floor(birdCount)) : 0;
  return {
    ageDay,
    gramsPerBird,
    birdCount: safeBirdCount,
    targetKg: (gramsPerBird * safeBirdCount) / 1000,
  };
}
