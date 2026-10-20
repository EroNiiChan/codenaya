/**
 * Runs `task` `delayMs` after the last `schedule()` and never twice at once: a
 * call that lands while the task runs queues exactly one more run after it.
 * `task` must handle its own errors.
 */
export const debounceSerial = (task: () => Promise<void>, delayMs: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let pending = false;

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(run, delayMs);
  };

  const run = async () => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      await task();
    } finally {
      running = false;
      if (pending) {
        pending = false;
        schedule();
      }
    }
  };

  return { schedule, cancel: () => clearTimeout(timer) };
};
