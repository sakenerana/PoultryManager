export const FEED_CODES = ["510", "511", "512", "513"] as const;

export const FEED_CODE_OPTIONS = FEED_CODES.map((code) => ({
  value: code,
  label: code,
}));
