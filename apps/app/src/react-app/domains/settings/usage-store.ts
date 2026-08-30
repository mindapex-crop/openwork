/**
 * Usage store for the BYO (bring-your-own key) usage view. Framework-agnostic
 * (no React import) so it can be consumed from the React view or tested
 * directly; mirrors the DeliverySummaryStore subscription pattern.
 */

export interface UsageSummaryItem {
  provider: string;
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface UsageTotals {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface UsageSummary {
  items: UsageSummaryItem[];
  totals: UsageTotals;
  generatedAt: number;
}

export interface UsageStoreSnapshot {
  summary: UsageSummary | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
}

export type UsageStore = ReturnType<typeof createUsageStore>;

export interface CreateUsageStoreOptions {
  /** Fetch the usage summary (e.g. GET /api/usage/summary via the server client). */
  fetchSummary: () => Promise<UsageSummary>;
  /** Injectable snapshot for tests / previews. */
  initial?: UsageStoreSnapshot;
}

const INITIAL_SNAPSHOT: UsageStoreSnapshot = {
  summary: null,
  status: "idle",
  error: null,
};

export function createUsageStore(options: CreateUsageStoreOptions) {
  const listeners = new Set<() => void>();
  let snapshot: UsageStoreSnapshot = options.initial ?? INITIAL_SNAPSHOT;
  let loadInFlight: Promise<void> | null = null;

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const set = (next: UsageStoreSnapshot) => {
    snapshot = next;
    emit();
  };

  const load = async (): Promise<UsageStoreSnapshot> => {
    if (loadInFlight) {
      await loadInFlight;
      return snapshot;
    }
    loadInFlight = (async () => {
      set({ summary: snapshot.summary, status: "loading", error: null });
      try {
        const summary = await options.fetchSummary();
        set({ summary, status: "ready", error: null });
      } catch (error) {
        set({
          summary: snapshot.summary,
          status: "error",
          error: error instanceof Error ? error.message : "Failed to load usage summary",
        });
      } finally {
        loadInFlight = null;
      }
    })();
    await loadInFlight;
    return snapshot;
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const getSnapshot = () => snapshot;

  return { subscribe, getSnapshot, load, refresh: load };
}

// ---------------------------------------------------------------------------
// Formatting helpers (pure, unit-testable)
// ---------------------------------------------------------------------------

export function formatTokenCount(value: number): string {
  const n = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (n < 1_000) return String(Math.trunc(n));
  if (n < 1_000_000) {
    const k = n / 1_000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}K`;
  }
  const m = n / 1_000_000;
  return `${m >= 100 ? Math.round(m) : m.toFixed(1)}M`;
}

export function formatUsd(value: number): string {
  const n = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `$${n.toFixed(2)}`;
}

/** Group summary items by provider, preserving first-seen order. */
export function groupItemsByProvider(items: UsageSummaryItem[]): Array<{
  provider: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  models: UsageSummaryItem[];
}> {
  const order: string[] = [];
  const groups = new Map<string, {
    provider: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    models: UsageSummaryItem[];
  }>();
  for (const item of items) {
    let group = groups.get(item.provider);
    if (!group) {
      group = {
        provider: item.provider,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        models: [],
      };
      groups.set(item.provider, group);
      order.push(item.provider);
    }
    group.requests += item.requests;
    group.inputTokens += item.inputTokens;
    group.outputTokens += item.outputTokens;
    group.totalTokens += item.totalTokens;
    group.estimatedCostUsd += item.estimatedCostUsd;
    group.models.push(item);
  }
  return order.map((provider) => groups.get(provider)!);
}

/** Default store instance (lazily wired by the view's host). */
export const defaultUsageStore = (fetchSummary: () => Promise<UsageSummary>) => createUsageStore({ fetchSummary });
