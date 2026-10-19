export class RequestScope {
  private closed = false;
  private controllers = new Set<AbortController>();
  close() {
    this.closed = true;
    for (const c of this.controllers) c.abort();
    this.controllers.clear();
  }
  async run<T>(
    task: (signal: AbortSignal) => Promise<T>,
    apply: (value: T) => void,
    fail?: (e: Error) => void,
  ) {
    if (this.closed) return;
    const c = new AbortController();
    this.controllers.add(c);
    try {
      const value = await task(c.signal);
      if (!this.closed && !c.signal.aborted) apply(value);
    } catch (e) {
      if (!this.closed && !c.signal.aborted) fail?.(e as Error);
    } finally {
      this.controllers.delete(c);
    }
  }
}
