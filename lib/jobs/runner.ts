/**
 * Returns true if the last run (indicated by latestCreatedAt) is older than
 * staleAfterHours, or if there has never been a run.
 */
export function isStale(
  latestCreatedAt: Date | null,
  staleAfterHours = 20
): boolean {
  if (!latestCreatedAt) return true;
  const ageMs = Date.now() - latestCreatedAt.getTime();
  return ageMs > staleAfterHours * 60 * 60 * 1000;
}

/**
 * Starts a recurring background job. Runs immediately, then on the given
 * interval. Errors are caught and logged — the job always reschedules.
 */
export function startJob(
  name: string,
  intervalMs: number,
  run: () => Promise<void>
): void {
  const safeRun = async () => {
    try {
      await run();
    } catch (err) {
      console.error(`[${name}] failed:`, err);
    }
  };

  void safeRun();
  setInterval(safeRun, intervalMs);
}
