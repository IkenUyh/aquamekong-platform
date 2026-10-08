/**
 * Phần trăm làm tròn đến số nguyên mà tổng vẫn là 100 (phương pháp phần dư lớn nhất).
 * Làm tròn từng phần riêng lẻ có thể ra 101% (vd. 5, 8, 27 / 40 → 13 + 20 + 68).
 */
export function roundedPercents(counts: number[]): number[] {
  const total = counts.reduce((sum, c) => sum + c, 0);
  if (total <= 0) return counts.map(() => 0);

  const exact = counts.map((c) => (c / total) * 100);
  const result = exact.map(Math.floor);
  let missing = 100 - result.reduce((sum, p) => sum + p, 0);
  const byRemainder = exact
    .map((p, i) => ({ i, rest: p - Math.floor(p) }))
    .sort((a, b) => b.rest - a.rest);
  for (const { i } of byRemainder) {
    if (missing <= 0) break;
    result[i] += 1;
    missing -= 1;
  }
  return result;
}
