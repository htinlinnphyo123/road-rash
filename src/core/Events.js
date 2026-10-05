class Emitter {
  #h = new Map();
  on(type, fn) {
    if (!this.#h.has(type)) this.#h.set(type, new Set());
    this.#h.get(type).add(fn);
    return () => this.#h.get(type).delete(fn);
  }
  emit(type, data) { this.#h.get(type)?.forEach((fn) => fn(data)); }
}
export const events = new Emitter();