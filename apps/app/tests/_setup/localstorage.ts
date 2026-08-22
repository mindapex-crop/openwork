/**
 * Bun test runs in a node-like environment but the knowledge store (and other
 * zustand persist stores) read from `localStorage`. Provide a minimal stub
 * so tests can exercise persistence without a real DOM.
 */

class LocalStorageStub {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  get length(): number {
    return this.store.size;
  }
}

// Replace any existing stub so a fresh instance is used per test run.
(globalThis as unknown as { localStorage: LocalStorageStub }).localStorage =
  new LocalStorageStub();

// Some app code reads from `window.localStorage`; alias window to globalThis.
(globalThis as unknown as { window: typeof globalThis }).window = globalThis;
