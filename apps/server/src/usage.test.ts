import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetUsageDbCacheForTests, getUsageSummary, recordUsage, estimateUsageCostUsd } from "./usage.js";
import type { ServerConfig } from "./types.js";

let workspace: string;
let config: ServerConfig;
const previousRuntimeDb = process.env.OPENWORK_RUNTIME_DB;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), "openwork-usage-"));
  process.env.OPENWORK_RUNTIME_DB = join(workspace, "state", "runtime.sqlite");
  config = {
    host: "127.0.0.1",
    port: 0,
    token: "token",
    hostToken: "host-token",
    approval: { mode: "auto", timeoutMs: 0 },
    corsOrigins: [],
    workspaces: [{ id: "ws_usage", name: "Test", path: workspace, preset: "starter", workspaceType: "local" }],
    authorizedRoots: [workspace],
    readOnly: false,
    startedAt: Date.now(),
    tokenSource: "generated",
    hostTokenSource: "generated",
    logFormat: "pretty",
    logRequests: false,
  };
});

afterEach(async () => {
  resetUsageDbCacheForTests();
  await rm(workspace, { recursive: true, force: true });
  if (previousRuntimeDb === undefined) delete process.env.OPENWORK_RUNTIME_DB;
  else process.env.OPENWORK_RUNTIME_DB = previousRuntimeDb;
});

describe("recordUsage + getUsageSummary", () => {
  test("aggregates token usage by provider and model", async () => {
    await recordUsage(config, {
      workspaceId: "ws_usage",
      sessionId: "ses_1",
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 1_000,
      outputTokens: 500,
      createdAt: 1_700_000_000_000,
    });
    await recordUsage(config, {
      workspaceId: "ws_usage",
      sessionId: "ses_1",
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 2_000,
      outputTokens: 300,
      createdAt: 1_700_000_000_001,
    });
    await recordUsage(config, {
      workspaceId: "ws_usage",
      sessionId: "ses_2",
      provider: "anthropic",
      model: "claude-sonnet-4",
      inputTokens: 500,
      outputTokens: 100,
      createdAt: 1_700_000_000_002,
    });

    const summary = await getUsageSummary(config);
    expect(summary.items).toHaveLength(2);

    const openai = summary.items.find((item) => item.provider === "openai");
    expect(openai?.model).toBe("gpt-4o");
    expect(openai?.requests).toBe(2);
    expect(openai?.inputTokens).toBe(3_000);
    expect(openai?.outputTokens).toBe(800);
    expect(openai?.totalTokens).toBe(3_800);

    const anthropic = summary.items.find((item) => item.provider === "anthropic");
    expect(anthropic?.requests).toBe(1);
    expect(anthropic?.inputTokens).toBe(500);
    expect(anthropic?.outputTokens).toBe(100);

    expect(summary.totals.requests).toBe(3);
    expect(summary.totals.inputTokens).toBe(3_500);
    expect(summary.totals.outputTokens).toBe(900);
    expect(summary.totals.totalTokens).toBe(4_400);
    expect(summary.generatedAt).toBeGreaterThan(0);
  });

  test("filters by workspace, session, and time range", async () => {
    await recordUsage(config, {
      workspaceId: "ws_a", sessionId: "ses_a", provider: "openai", model: "gpt-4o-mini",
      inputTokens: 100, outputTokens: 10, createdAt: 1_000,
    });
    await recordUsage(config, {
      workspaceId: "ws_b", sessionId: "ses_b", provider: "openai", model: "gpt-4o-mini",
      inputTokens: 200, outputTokens: 20, createdAt: 2_000,
    });
    await recordUsage(config, {
      workspaceId: "ws_a", sessionId: "ses_b", provider: "openai", model: "gpt-4o-mini",
      inputTokens: 300, outputTokens: 30, createdAt: 3_000,
    });

    const byWorkspace = await getUsageSummary(config, { workspaceId: "ws_a" });
    expect(byWorkspace.totals.inputTokens).toBe(400);

    const bySession = await getUsageSummary(config, { sessionId: "ses_b" });
    expect(bySession.totals.inputTokens).toBe(500);

    const byRange = await getUsageSummary(config, { from: 1_500, to: 3_500 });
    expect(byRange.totals.requests).toBe(2);
    expect(byRange.totals.inputTokens).toBe(500);
  });

  test("clamps negative token counts to zero", async () => {
    await recordUsage(config, {
      workspaceId: "ws_usage", sessionId: "ses_1", provider: "p", model: "m",
      inputTokens: -10, outputTokens: 5,
    });
    const summary = await getUsageSummary(config);
    expect(summary.items[0]?.inputTokens).toBe(0);
    expect(summary.items[0]?.outputTokens).toBe(5);
  });
});

describe("estimateUsageCostUsd", () => {
  test("resolves known models by prefix", () => {
    // openai/gpt-4o: $2.5/1M input, $10/1M output
    expect(estimateUsageCostUsd("openai", "gpt-4o", 1_000_000, 1_000_000)).toBe(12.5);
    // dated model id still resolves to gpt-4o pricing
    expect(estimateUsageCostUsd("openai", "gpt-4o-2024-08-06", 2_000_000, 0)).toBe(5);
    // anthropic/claude-sonnet: $3/1M input
    expect(estimateUsageCostUsd("anthropic", "claude-sonnet-4-5", 1_000_000, 0)).toBe(3);
  });

  test("falls back to the default price for unknown models", () => {
    expect(estimateUsageCostUsd("unknown", "model-x", 1_000_000, 1_000_000)).toBe(4);
  });

  test("rounds to cents", () => {
    expect(estimateUsageCostUsd("openai", "gpt-4o-mini", 1, 1)).toBe(0);
    expect(estimateUsageCostUsd("openai", "gpt-4o", 123_456, 654_321)).toBe(6.85);
  });
});
