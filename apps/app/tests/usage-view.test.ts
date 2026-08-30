import { describe, expect, test } from "bun:test";

import {
  createUsageStore,
  formatTokenCount,
  formatUsd,
  groupItemsByProvider,
  type UsageSummary,
  type UsageSummaryItem,
} from "../src/react-app/domains/settings/usage-store";

const openaiItem: UsageSummaryItem = {
  provider: "openai",
  model: "gpt-4o",
  requests: 2,
  inputTokens: 3_000,
  outputTokens: 800,
  totalTokens: 3_800,
  estimatedCostUsd: 1.55,
};

const openaiMiniItem: UsageSummaryItem = {
  provider: "openai",
  model: "gpt-4o-mini",
  requests: 5,
  inputTokens: 10_000,
  outputTokens: 2_000,
  totalTokens: 12_000,
  estimatedCostUsd: 0.03,
};

const anthropicItem: UsageSummaryItem = {
  provider: "anthropic",
  model: "claude-sonnet-4",
  requests: 1,
  inputTokens: 500,
  outputTokens: 100,
  totalTokens: 600,
  estimatedCostUsd: 0.3,
};

function summaryOf(items: UsageSummaryItem[]): UsageSummary {
  return {
    items,
    totals: items.reduce(
      (acc, item) => ({
        requests: acc.requests + item.requests,
        inputTokens: acc.inputTokens + item.inputTokens,
        outputTokens: acc.outputTokens + item.outputTokens,
        totalTokens: acc.totalTokens + item.totalTokens,
        estimatedCostUsd: acc.estimatedCostUsd + item.estimatedCostUsd,
      }),
      { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
    ),
    generatedAt: 1_700_000_000_000,
  };
}

describe("usage formatting helpers", () => {
  test("formats token counts with K/M suffixes", () => {
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(999)).toBe("999");
    expect(formatTokenCount(1_200)).toBe("1.2K");
    expect(formatTokenCount(123_000)).toBe("123K");
    expect(formatTokenCount(1_500_000)).toBe("1.5M");
    expect(formatTokenCount(-5)).toBe("0");
    expect(formatTokenCount(Number.NaN)).toBe("0");
  });

  test("formats USD with two decimals", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(12.5)).toBe("$12.50");
    expect(formatUsd(0.034)).toBe("$0.03");
    expect(formatUsd(-1)).toBe("$0.00");
  });
});

describe("groupItemsByProvider", () => {
  test("aggregates items per provider preserving first-seen order", () => {
    const groups = groupItemsByProvider([openaiMiniItem, anthropicItem, openaiItem]);
    expect(groups.map((group) => group.provider)).toEqual(["openai", "anthropic"]);

    const openai = groups[0];
    expect(openai?.requests).toBe(7);
    expect(openai?.inputTokens).toBe(13_000);
    expect(openai?.outputTokens).toBe(2_800);
    expect(openai?.totalTokens).toBe(15_800);
    expect(openai?.estimatedCostUsd).toBeCloseTo(1.58, 2);
    expect(openai?.models.map((model) => model.model)).toEqual(["gpt-4o-mini", "gpt-4o"]);

    const anthropic = groups[1];
    expect(anthropic?.requests).toBe(1);
    expect(anthropic?.models).toHaveLength(1);
  });

  test("returns an empty array for no items", () => {
    expect(groupItemsByProvider([])).toEqual([]);
  });
});

describe("createUsageStore", () => {
  test("loads a summary and transitions idle -> loading -> ready", async () => {
    const summary = summaryOf([openaiItem, anthropicItem]);
    const store = createUsageStore({ fetchSummary: async () => summary });

    expect(store.getSnapshot().status).toBe("idle");

    let notified = 0;
    const unsubscribe = store.subscribe(() => {
      notified += 1;
    });

    const loading = store.load();
    expect(store.getSnapshot().status).toBe("loading");
    await loading;

    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe("ready");
    expect(snapshot.summary?.totals.requests).toBe(3);
    expect(snapshot.summary?.totals.estimatedCostUsd).toBeCloseTo(1.85, 2);
    expect(notified).toBeGreaterThanOrEqual(2);

    unsubscribe();
  });

  test("surfaces fetch errors without losing the previous snapshot", async () => {
    const store = createUsageStore({
      fetchSummary: async () => {
        throw new Error("network down");
      },
    });
    await store.load();
    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe("error");
    expect(snapshot.error).toBe("network down");
    expect(snapshot.summary).toBeNull();
  });

  test("deduplicates concurrent loads", async () => {
    let calls = 0;
    const store = createUsageStore({
      fetchSummary: async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return summaryOf([]);
      },
    });
    const [a, b] = await Promise.all([store.load(), store.load()]);
    expect(calls).toBe(1);
    expect(a.status).toBe("ready");
    expect(b.status).toBe("ready");
  });
});
