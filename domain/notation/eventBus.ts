type EventHandler<T> = (payload: T) => void;

export class NotationEventBus<Events extends object> {
  private handlers = new Map<keyof Events, Set<EventHandler<any>>>();

  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    const set = this.handlers.get(event) ?? new Set<EventHandler<any>>();
    set.add(handler as EventHandler<any>);
    this.handlers.set(event, set);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    const set = this.handlers.get(event);
    if (!set) return;
    set.delete(handler as EventHandler<any>);
    if (set.size === 0) {
      this.handlers.delete(event);
    }
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    set.forEach(handler => handler(payload));
  }
}
