/**
 * Repeats `run` on a fixed interval without ever letting two runs overlap.
 *
 * `setInterval` fires on wall-clock time regardless of whether the previous
 * tick finished, so a run that outlives its interval (large batch, slow
 * database, stalled SMTP) gets joined by the next one and they pile up. Jobs
 * that claim their work with `FOR UPDATE SKIP LOCKED` tolerate that; jobs that
 * read a due set and then act on it do not — two overlapping runs see the same
 * rows and act on them twice.
 *
 * A tick that arrives while the previous run is still in flight is skipped.
 */
export function scheduleNonOverlapping(
  intervalMs: number,
  run: () => Promise<void>,
  onError: (error: unknown) => void,
  onSkip?: () => void,
): NodeJS.Timeout {
  let running = false;

  return setInterval(() => {
    if (running) {
      onSkip?.();
      return;
    }

    running = true;
    run()
      .catch(onError)
      .finally(() => {
        running = false;
      });
  }, intervalMs);
}
