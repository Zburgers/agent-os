type Listener<T> = (data: T) => void;

export class TypedEmitter<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<Listener<unknown>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this {
    const current = this.listeners.get(event) ?? new Set<Listener<unknown>>();
    current.add(listener as Listener<unknown>);
    this.listeners.set(event, current);
    return this;
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this {
    const current = this.listeners.get(event);
    current?.delete(listener as Listener<unknown>);
    if (current?.size === 0) this.listeners.delete(event);
    return this;
  }

  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this {
    const wrapped: Listener<Events[K]> = (data) => {
      this.off(event, wrapped);
      listener(data);
    };
    return this.on(event, wrapped);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): boolean {
    const current = this.listeners.get(event);
    if (!current?.size) return false;
    for (const listener of [...current]) listener(data);
    return true;
  }

  listenerCount<K extends keyof Events>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
