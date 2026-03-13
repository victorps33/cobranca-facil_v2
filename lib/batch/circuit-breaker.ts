const FAILURE_RATE_THRESHOLD = 0.2;

export function shouldHalt(stats: { total: number; failed: number }): boolean {
  if (stats.total === 0) return false;
  return stats.failed / stats.total > FAILURE_RATE_THRESHOLD;
}
