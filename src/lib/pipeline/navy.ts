/**
 * US Navy body-fat formula.
 *
 * Returns null when the inputs are out of valid range so callers can fall
 * back without throwing. Used by the live aggregator and by the offline
 * weight optimizer — keep a single source of truth.
 */
export function navyBodyFat(
  gender: string,
  neckCm: number,
  waistCm: number,
  hipCm: number | undefined,
  heightCm: number,
): number | null {
  if (gender === 'male') {
    if (waistCm <= neckCm) return null;
    return (
      86.01 * Math.log10(waistCm - neckCm) -
      70.041 * Math.log10(heightCm) +
      36.76
    );
  }
  if (gender === 'female') {
    if (!hipCm || waistCm + hipCm <= neckCm) return null;
    return (
      163.205 * Math.log10(waistCm + hipCm - neckCm) -
      97.684 * Math.log10(heightCm) +
      78.387
    );
  }
  return null;
}
