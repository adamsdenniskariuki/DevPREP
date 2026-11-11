export type Handler = (payload: unknown) => void;
export type AnyHandler = (event: string, payload: unknown) => void;

export class EventBus {
  private handlers = new Map<string, Handler[]>();
  private anyHandlers: AnyHandler[] = [];

  on(event: string, handler: Handler): () => void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
    return () => this.off(event, handler);
  }

  once(event: string, handler: Handler): () => void {
    const wrapper: Handler = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }

  off(event: string, handler: Handler): void {
    const list = this.handlers.get(event);
    if (!list) return;
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  }

  /** Called after the specific handlers for every event. Returns an unsubscribe function. */
  onAny(handler: AnyHandler): () => void {
    this.anyHandlers.push(handler);
    return () => {
      const index = this.anyHandlers.indexOf(handler);
      if (index >= 0) this.anyHandlers.splice(index, 1);
    };
  }

  emit(event: string, payload?: unknown): number {
    const list = [...(this.handlers.get(event) ?? [])];
    for (const handler of list) handler(payload);
    const any = [...this.anyHandlers];
    for (const handler of any) handler(event, payload);
    return list.length + any.length;
  }

  count(event: string): number {
    return this.handlers.get(event)?.length ?? 0;
  }
}
