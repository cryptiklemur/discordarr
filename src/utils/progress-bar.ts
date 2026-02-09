export function progressBar(
  percent: number,
  length: number = 20,
): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * length);
  const empty = length - filled;
  return `[${"=".repeat(filled)}${"-".repeat(empty)}] ${clamped.toFixed(0)}%`;
}
