/** @jsxImportSource react */
import * as React from "react";
import { Coins, Cpu, RefreshCcw, TriangleAlert } from "lucide-react";

import type { UsageStore, UsageSummary } from "../usage-store";
import {
  createUsageStore,
  formatTokenCount,
  formatUsd,
  groupItemsByProvider,
} from "../usage-store";

export type UsageViewProps = {
  /** Store to render. When omitted a store is created lazily from loadSummary. */
  store?: UsageStore;
  /** Fetch the usage summary (defaults to the server's /api/usage/summary via the host). */
  loadSummary?: () => Promise<UsageSummary>;
  className?: string;
};

const EMPTY_SUMMARY: UsageSummary = {
  items: [],
  totals: { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
  generatedAt: 0,
};

function useStoreSnapshot(store: UsageStore) {
  return React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

function SummaryCard(props: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{props.label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{props.value}</div>
      {props.sub ? <div className="mt-0.5 text-xs text-zinc-400">{props.sub}</div> : null}
    </div>
  );
}

function UsageTable(props: { rows: ReturnType<typeof groupItemsByProvider> }) {
  if (props.rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        No usage recorded yet for your own keys.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-2.5 font-medium">Provider</th>
            <th className="px-4 py-2.5 font-medium">Models</th>
            <th className="px-4 py-2.5 text-right font-medium">Requests</th>
            <th className="px-4 py-2.5 text-right font-medium">Tokens</th>
            <th className="px-4 py-2.5 text-right font-medium">Est. cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {props.rows.map((group) => (
            <tr key={group.provider} className="align-top">
              <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{group.provider}</td>
              <td className="px-4 py-3">
                <ul className="space-y-1">
                  {group.models.map((model) => (
                    <li key={`${model.provider}/${model.model}`} className="text-zinc-600 dark:text-zinc-300">
                      {model.model}
                      <span className="ml-2 text-xs text-zinc-400">
                        {formatTokenCount(model.inputTokens)} in / {formatTokenCount(model.outputTokens)} out
                      </span>
                    </li>
                  ))}
                </ul>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                {formatTokenCount(group.requests)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                {formatTokenCount(group.totalTokens)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                {formatUsd(group.estimatedCostUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * BYO key usage view: a per-provider usage table plus summary cards.
 * Not route-mounted here — the settings host wires the store and mounts it.
 */
export function UsageView(props: UsageViewProps) {
  const lazyStoreRef = React.useRef<UsageStore | null>(null);
  if (!props.store && !lazyStoreRef.current) {
    const fetchSummary = props.loadSummary ?? (() => Promise.resolve(EMPTY_SUMMARY));
    lazyStoreRef.current = createUsageStore({ fetchSummary });
  }
  const store = props.store ?? lazyStoreRef.current!;
  const snapshot = useStoreSnapshot(store);

  React.useEffect(() => {
    if (snapshot.status === "idle") {
      void store.load();
    }
  }, [store, snapshot.status]);

  const totals = snapshot.summary?.totals;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Usage (own keys)</h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Token usage and estimated cost across providers using your own API keys.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void store.load()}
          disabled={snapshot.status === "loading"}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <RefreshCcw className={snapshot.status === "loading" ? "size-3.5 animate-spin" : "size-3.5"} />
          Refresh
        </button>
      </div>

      {snapshot.status === "error" ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <TriangleAlert className="size-4" />
          {snapshot.error ?? "Failed to load usage summary"}
        </div>
      ) : null}

      {totals ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Total requests" value={formatTokenCount(totals.requests)} />
          <SummaryCard label="Total tokens" value={formatTokenCount(totals.totalTokens)} sub={`${formatTokenCount(totals.inputTokens)} in · ${formatTokenCount(totals.outputTokens)} out`} />
          <SummaryCard label="Estimated cost" value={formatUsd(totals.estimatedCostUsd)} sub="USD, approximate" />
          <SummaryCard label="Providers" value={String(snapshot.summary?.items ? new Set(snapshot.summary.items.map((item) => item.provider)).size : 0)} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Total requests" value="—" />
          <SummaryCard label="Total tokens" value="—" />
          <SummaryCard label="Estimated cost" value="—" />
          <SummaryCard label="Providers" value="—" />
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <Coins className="size-4 text-zinc-400" />
          By provider
        </div>
        <UsageTable rows={groupItemsByProvider(snapshot.summary?.items ?? [])} />
      </div>

      <p className="flex items-center gap-1.5 text-xs text-zinc-400">
        <Cpu className="size-3.5" />
        Cost estimates use built-in per-model prices; treat them as approximate.
      </p>
    </div>
  );
}
