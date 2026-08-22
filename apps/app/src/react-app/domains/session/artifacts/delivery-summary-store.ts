/**
 * Lightweight pure-TS data model + localStorage-backed persistence for the
 * "Delivery Summary" panel. Kept framework-agnostic (no React) so it can be
 * consumed by the React panel or by any other surface without coupling.
 */

export type DeliveryType = "markdown" | "docx" | "xlsx" | "pptx" | "pdf" | "image" | "code";

export interface DeliveryItem {
  id: string;
  name: string;
  type: DeliveryType;
  /** size in bytes */
  size: number;
  sourcePath: string;
  createdAt: number;
}

export type NewDeliveryItem = Omit<DeliveryItem, "id" | "createdAt">;

export interface DeliveryGroup {
  type: DeliveryType;
  items: DeliveryItem[];
}

export const DELIVERY_TYPE_ORDER: readonly DeliveryType[] = [
  "markdown",
  "docx",
  "xlsx",
  "pptx",
  "pdf",
  "image",
  "code",
];

export const DELIVERY_TYPE_LABELS: Readonly<Record<DeliveryType, string>> = {
  markdown: "Markdown",
  docx: "Word",
  xlsx: "Excel",
  pptx: "Slides",
  pdf: "PDF",
  image: "Image",
  code: "Code",
};

const DEFAULT_STORAGE_KEY = "openwork.delivery.summary.items";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const DELIVERY_TYPE_VALUES = new Set<string>(DELIVERY_TYPE_ORDER);

function isDeliveryType(value: unknown): value is DeliveryType {
  return typeof value === "string" && DELIVERY_TYPE_VALUES.has(value);
}

function parseStoredItem(value: unknown): DeliveryItem | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  if (!isDeliveryType(value.type)) return null;
  if (typeof value.sourcePath !== "string") return null;

  return {
    id: value.id,
    name: value.name,
    type: value.type,
    size: typeof value.size === "number" ? value.size : 0,
    sourcePath: value.sourcePath,
    createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
  };
}

function parseStoredItems(raw: string | null): DeliveryItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items: DeliveryItem[] = [];
    for (const entry of parsed) {
      const item = parseStoredItem(entry);
      if (item) items.push(item);
    }
    return items;
  } catch {
    return [];
  }
}

function createItemId(): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `delivery-${random}`;
}

function resolveStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export interface DeliveryStoreOptions {
  storageKey?: string;
  /** Injectable storage for tests / previews. Falls back to window.localStorage. */
  storage?: Storage | null;
}

export class DeliverySummaryStore {
  private readonly key: string;
  private readonly storage: Storage | null;
  private items: DeliveryItem[];
  private readonly listeners = new Set<() => void>();

  constructor(options: DeliveryStoreOptions = {}) {
    this.key = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.storage = options.storage === undefined ? resolveStorage() : options.storage;
    this.items = this.readStored();
  }

  private readStored(): DeliveryItem[] {
    if (!this.storage) return [];
    return parseStoredItems(this.storage.getItem(this.key));
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.key, JSON.stringify(this.items));
    } catch {
      // ignore quota / privacy-mode errors
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  getItems(): DeliveryItem[] {
    return this.items;
  }

  /** Stable snapshot for useSyncExternalStore. */
  getSnapshot(): DeliveryItem[] {
    return this.items;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Non-empty groups in a stable display order. */
  groupByType(): DeliveryGroup[] {
    const groups: DeliveryGroup[] = [];
    for (const type of DELIVERY_TYPE_ORDER) {
      const matching = this.items.filter((item) => item.type === type);
      if (matching.length > 0) {
        groups.push({ type, items: matching });
      }
    }
    return groups;
  }

  addItem(input: NewDeliveryItem): DeliveryItem {
    const item: DeliveryItem = { ...input, id: createItemId(), createdAt: Date.now() };
    if (!this.items.some((existing) => existing.id === item.id)) {
      this.items = [...this.items, item];
      this.persist();
      this.emit();
    }
    return item;
  }

  addItems(inputs: NewDeliveryItem[]): DeliveryItem[] {
    const now = Date.now();
    const created: DeliveryItem[] = [];
    let next = this.items;
    for (const input of inputs) {
      const item: DeliveryItem = { ...input, id: createItemId(), createdAt: now };
      if (!next.some((existing) => existing.id === item.id)) {
        next = [...next, item];
        created.push(item);
      }
    }
    if (created.length > 0) {
      this.items = next;
      this.persist();
      this.emit();
    }
    return created;
  }

  removeItem(id: string): boolean {
    const next = this.items.filter((item) => item.id !== id);
    if (next.length === this.items.length) return false;
    this.items = next;
    this.persist();
    this.emit();
    return true;
  }

  clear(): void {
    if (this.items.length === 0) return;
    this.items = [];
    this.persist();
    this.emit();
  }
}

/** Default app-wide store instance shared by the Delivery Summary panel. */
export const deliveryItemsStore = new DeliverySummaryStore();