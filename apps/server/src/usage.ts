/**
 * Session-level usage accounting for BYO (bring-your-own) provider keys.
 *
 * Records token usage per provider/model/session into the runtime SQLite DB
 * (same store as the runtime config, see runtime-db.ts) and aggregates it into
 * a per-provider summary with an estimated USD cost.
 *
 * Cost estimates use a small built-in price table (USD per 1M tokens); unknown
 * models fall back to a conservative default so the UI always has a number
 * instead of a gap.
 */

import { randomUUID } from "node:crypto";
import type { Database as BunDatabase, SQLQueryBindings } from "bun:sqlite";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { openRuntimeSqliteDatabase, runtimeDbPath, type RuntimeSqliteDatabase } from "./runtime-db.js";
import type { ServerConfig } from "./types.js";

export interface UsageEventInput {
  workspaceId: string;
  sessionId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  createdAt?: number;
}

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

export interface UsageSummaryFilter {
  workspaceId?: string;
  sessionId?: string;
  /** Inclusive millisecond timestamp. */
  from?: number;
  /** Exclusive millisecond timestamp. */
  to?: number;
}

const USAGE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS openwork_usage_events (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  created_at INTEGER NOT NULL
)
`;

const INSERT_SQL = `
INSERT INTO openwork_usage_events
  (id, workspace_id, session_id, provider, model, input_tokens, output_tokens, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

const SUMMARY_SQL = `
SELECT
  provider,
  model,
  COUNT(*) AS requests,
  COALESCE(SUM(input_tokens), 0) AS input_tokens,
  COALESCE(SUM(output_tokens), 0) AS output_tokens
FROM openwork_usage_events
WHERE 1 = 1
  AND (? IS NULL OR workspace_id = ?)
  AND (? IS NULL OR session_id = ?)
  AND (? IS NULL OR created_at >= ?)
  AND (? IS NULL OR created_at < ?)
GROUP BY provider, model
ORDER BY provider ASC, model ASC
`;

// USD per 1M tokens. Provider/model keys match on a prefix basis so
// dated model ids (e.g. "openai/gpt-4o-2024-08-06") still resolve.
const PRICES_PER_MILLION: ReadonlyArray<{ match: string; input: number; output: number }> = [
  { match: "openai/gpt-4o", input: 2.5, output: 10 },
  { match: "openai/gpt-4", input: 2.5, output: 10 },
  { match: "openai/gpt-4.1", input: 2, output: 8 },
  { match: "openai/gpt-4.1-mini", input: 0.4, output: 1.6 },
  { match: "openai/gpt-4o-mini", input: 0.15, output: 0.6 },
  { match: "openai/o3", input: 2, output: 8 },
  { match: "openai/o4-mini", input: 1.1, output: 4.4 },
  { match: "openai/gpt-5", input: 1.25, output: 10 },
  { match: "openai/gpt-5-mini", input: 0.25, output: 2 },
  { match: "anthropic/claude", input: 3, output: 15 },
  { match: "anthropic/claude-sonnet", input: 3, output: 15 },
  { match: "anthropic/claude-haiku", input: 1, output: 5 },
  { match: "google/gemini-2.5-pro", input: 1.25, output: 10 },
  { match: "google/gemini-2.5-flash", input: 0.3, output: 2.5 },
  { match: "google/gemini-2.0-flash", input: 0.1, output: 0.4 },
  { match: "xai/grok", input: 3, output: 15 },
  { match: "meta-llama", input: 0.15, output: 0.6 },
  { match: "deepseek", input: 0.27, output: 1.1 },
];

const DEFAULT_PRICE_PER_MILLION = { input: 1, output: 3 } as const;

export function estimateUsageCostUsd(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  const key = `${provider}/${model}`.toLowerCase();
  const price = PRICES_PER_MILLION.find((entry) => key.startsWith(entry.match)) ?? DEFAULT_PRICE_PER_MILLION;
  const input = Math.max(0, inputTokens) / 1_000_000 * price.input;
  const output = Math.max(0, outputTokens) / 1_000_000 * price.output;
  return roundUsd(input + output);
}

export function roundUsd(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

type UsageDb = {
  kind: "bun" | "node";
  sqlite: BunDatabase | DatabaseSync;
  run: (sql: string, params?: SQLQueryBindings[]) => void;
  all: (sql: string, params?: SQLQueryBindings[]) => Record<string, unknown>[];
  close: () => void;
};

const dbByPath = new Map<string, Promise<UsageDb>>();

async function usageDb(config: ServerConfig): Promise<UsageDb> {
  const path = runtimeDbPath(config);
  const existing = dbByPath.get(path);
  if (existing) return existing;
  const opening = openUsageDb(path);
  dbByPath.set(path, opening);
  return opening;
}

async function openUsageDb(path: string): Promise<UsageDb> {
  const runtime: RuntimeSqliteDatabase = await openRuntimeSqliteDatabase(path);
  if (runtime.kind === "bun") {
    runtime.sqlite.run(USAGE_TABLE_SQL);
    return {
      kind: "bun",
      sqlite: runtime.sqlite,
      run: (sql, params = []) => {
        runtime.sqlite.run(sql, params);
      },
      all: (sql, params = []) =>
        runtime.sqlite.query<Record<string, unknown>, SQLQueryBindings[]>(sql).all(...params),
      close: runtime.close,
    };
  }
  runtime.sqlite.exec(USAGE_TABLE_SQL);
  const preparedRun = runtime.sqlite.prepare("INSERT INTO openwork_usage_events (id, workspace_id, session_id, provider, model, input_tokens, output_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const preparedSummary = runtime.sqlite.prepare(SUMMARY_SQL);
  const toNodeParams = (params: SQLQueryBindings[]) => params as SQLInputValue[];
  return {
    kind: "node",
    sqlite: runtime.sqlite,
    run: (sql, params = []) => {
      if (sql === INSERT_SQL) {
        preparedRun.run(...toNodeParams(params));
        return;
      }
      runtime.sqlite.exec(sql);
    },
    all: (sql, params = []) => {
      if (sql === SUMMARY_SQL) {
        return preparedSummary.all(...toNodeParams(params)) as Record<string, unknown>[];
      }
      const statement = runtime.sqlite.prepare(sql);
      return statement.all(...toNodeParams(params)) as Record<string, unknown>[];
    },
    close: runtime.close,
  };
}

export function usageDbCacheStatsForTests(path: string): { entries: number } {
  return { entries: dbByPath.has(path) ? 1 : 0 };
}

/**
 * Record one usage event for a session. Token counts must be non-negative;
 * the event is still recorded with clamped zeroes otherwise so accounting
 * never throws on bad provider data.
 */
export async function recordUsage(config: ServerConfig, input: UsageEventInput): Promise<void> {
  const db = await usageDb(config);
  const createdAt = input.createdAt ?? Date.now();
  db.run(INSERT_SQL, [
    randomUUID(),
    input.workspaceId,
    input.sessionId,
    input.provider,
    input.model,
    Math.max(0, Math.trunc(input.inputTokens)),
    Math.max(0, Math.trunc(input.outputTokens)),
    createdAt,
  ]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberField(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Aggregate recorded usage by provider/model. `workspaceId` filters to a
 * single workspace (or all when omitted); `from`/`to` bound by timestamp.
 */
export async function getUsageSummary(config: ServerConfig, filter: UsageSummaryFilter = {}): Promise<UsageSummary> {
  const db = await usageDb(config);
  const rows = db.all(SUMMARY_SQL, [
    filter.workspaceId ?? null, filter.workspaceId ?? null,
    filter.sessionId ?? null, filter.sessionId ?? null,
    filter.from ?? null, filter.from ?? null,
    filter.to ?? null, filter.to ?? null,
  ]);

  const items: UsageSummaryItem[] = rows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const provider = typeof row.provider === "string" ? row.provider : "";
    const model = typeof row.model === "string" ? row.model : "";
    if (!provider || !model) return [];
    const requests = numberField(row.requests);
    const inputTokens = numberField(row.input_tokens);
    const outputTokens = numberField(row.output_tokens);
    const totalTokens = inputTokens + outputTokens;
    return [{
      provider,
      model,
      requests,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCostUsd: estimateUsageCostUsd(provider, model, inputTokens, outputTokens),
    }];
  });

  const totals: UsageTotals = items.reduce<UsageTotals>(
    (acc, item) => ({
      requests: acc.requests + item.requests,
      inputTokens: acc.inputTokens + item.inputTokens,
      outputTokens: acc.outputTokens + item.outputTokens,
      totalTokens: acc.totalTokens + item.totalTokens,
      estimatedCostUsd: roundUsd(acc.estimatedCostUsd + item.estimatedCostUsd),
    }),
    { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
  );

  return { items, totals, generatedAt: Date.now() };
}

/** Drop the cached connection (used by tests). */
export function resetUsageDbCacheForTests(): void {
  for (const opening of dbByPath.values()) {
    void opening.then((db) => db.close()).catch(() => undefined);
  }
  dbByPath.clear();
}
