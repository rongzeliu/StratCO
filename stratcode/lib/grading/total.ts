import "server-only";

// Computes the weighted overall score (0 to 100) from Stage 1, 2, and 3 scores (each 0 to 10).
export function totalScore(s1: number, s2: number, s3: number): number {
  const raw = 3 * s1 + 3 * s2 + 4 * s3;
  return Math.round(raw * 100) / 100;
}
