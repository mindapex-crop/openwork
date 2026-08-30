/**
 * Experts 域 —— store（/api/experts CRUD + 失败兜底）与纯筛选逻辑测试。
 * 只测状态/逻辑层，不渲染 DOM。
 */
import "./_setup/localstorage";
import { afterEach, describe, expect, test } from "bun:test";

import {
  EXPERTS_API,
  filterExperts,
  useExpertsStore,
} from "../src/react-app/domains/experts/experts-store";
import type { Expert, ExpertInput } from "../src/react-app/domains/experts/types";

const realFetch = globalThis.fetch;

const sampleExpert: Expert = {
  id: "ex-1",
  name: "代码审查专家",
  description: "以代码评审视角检查改动并给出可落地建议",
  systemPrompt: "你是一名资深代码审查专家……",
  methodology: "先读 diff，再按正确性/可维护性/性能逐项评审",
  skills: ["code-review", "code-testing"],
  model: "deepseek-coder",
  avatar: "",
};

const sampleInput: ExpertInput = {
  name: "代码审查专家",
  description: "以代码评审视角检查改动并给出可落地建议",
  systemPrompt: "你是一名资深代码审查专家……",
  methodology: "先读 diff，再逐项评审",
  skills: ["code-review"],
  model: "deepseek-coder",
};

function mockFetchOk(payload: unknown, status = 200) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
}

function mockFetchError(status = 500) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "backend not ready" }), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
}

function resetStore() {
  useExpertsStore.setState({ experts: [], status: "idle", error: null });
}

afterEach(() => {
  resetStore();
  globalThis.fetch = realFetch;
});

describe("filterExperts 纯筛选", () => {
  test("空 query 返回全部专家", () => {
    expect(filterExperts([sampleExpert], "")).toHaveLength(1);
  });

  test("按 name / description / skills / model 命中", () => {
    const all = [sampleExpert];
    expect(filterExperts(all, "代码审查")).toHaveLength(1);
    expect(filterExperts(all, "review")).toHaveLength(1);
    expect(filterExperts(all, "diff")).toHaveLength(1);
    expect(filterExperts(all, "deepseek")).toHaveLength(1);
  });

  test("无命中返回空数组", () => {
    expect(filterExperts([sampleExpert], "不存在的关键词")).toHaveLength(0);
  });

  test("多关键词需全部命中", () => {
    expect(filterExperts([sampleExpert], "review 代码审查")).toHaveLength(1);
    expect(filterExperts([sampleExpert], "review 不存在")).toHaveLength(0);
  });
});

describe("experts store 初始与加载", () => {
  test("初始状态为空列表 + idle", () => {
    expect(useExpertsStore.getState().experts).toEqual([]);
    expect(useExpertsStore.getState().status).toBe("idle");
  });

  test("fetchExperts 成功后写入列表并进入 ready", async () => {
    mockFetchOk({ experts: [sampleExpert] });
    await useExpertsStore.getState().fetchExperts();
    expect(useExpertsStore.getState().status).toBe("ready");
    expect(useExpertsStore.getState().error).toBeNull();
    expect(useExpertsStore.getState().experts).toEqual([sampleExpert]);
  });

  test("fetchExperts 失败进入 error 并保留失败信息（兜底 UI 数据源）", async () => {
    mockFetchError(503);
    await useExpertsStore.getState().fetchExperts();
    expect(useExpertsStore.getState().status).toBe("error");
    expect(useExpertsStore.getState().error).toContain("backend not ready");
    expect(useExpertsStore.getState().experts).toEqual([]);
  });
});

describe("experts store CRUD", () => {
  test("createExpert 以 POST 调用 /api/experts 并追加到列表", async () => {
    let captured: { url: string; method: string; body: string } | null = null;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = {
        url: String(input),
        method: init?.method ?? "GET",
        body: String(init?.body ?? ""),
      };
      return new Response(JSON.stringify({ expert: { ...sampleExpert, id: "ex-new" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const created = await useExpertsStore.getState().createExpert(sampleInput);

    expect(captured?.url).toBe(EXPERTS_API);
    expect(captured?.method).toBe("POST");
    expect(JSON.parse(captured?.body ?? "{}")).toMatchObject({ name: "代码审查专家", skills: ["code-review"] });
    expect(created?.id).toBe("ex-new");
    expect(useExpertsStore.getState().experts.map((e) => e.id)).toContain("ex-new");
  });

  test("createExpert 失败时不污染列表并抛出错误", async () => {
    mockFetchError(400);
    await expect(useExpertsStore.getState().createExpert(sampleInput)).rejects.toThrow();
    expect(useExpertsStore.getState().experts).toEqual([]);
  });

  test("updateExpert 以 PUT 调用 /api/experts/:id 并更新对应条目", async () => {
    mockFetchOk({ experts: [sampleExpert] });
    await useExpertsStore.getState().fetchExperts();

    let captured: { url: string; method: string } | null = null;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(input), method: init?.method ?? "GET" };
      return new Response(JSON.stringify({ expert: { ...sampleExpert, name: "代码审查大师" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const updated = await useExpertsStore.getState().updateExpert("ex-1", {
      ...sampleInput,
      name: "代码审查大师",
    });

    expect(captured?.url).toBe(`${EXPERTS_API}/ex-1`);
    expect(captured?.method).toBe("PUT");
    expect(updated?.name).toBe("代码审查大师");
    expect(useExpertsStore.getState().experts.find((e) => e.id === "ex-1")?.name).toBe("代码审查大师");
  });

  test("updateExpert 对不存在的 id 为 no-op 不抛错", async () => {
    mockFetchError(404);
    await expect(
      useExpertsStore.getState().updateExpert("missing", sampleInput),
    ).rejects.toThrow();
  });

  test("deleteExpert 以 DELETE 调用 /api/experts/:id 并移除条目", async () => {
    mockFetchOk({ experts: [sampleExpert] });
    await useExpertsStore.getState().fetchExperts();

    let captured: { url: string; method: string } | null = null;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(input), method: init?.method ?? "GET" };
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    const deleted = await useExpertsStore.getState().deleteExpert("ex-1");
    expect(captured?.url).toBe(`${EXPERTS_API}/ex-1`);
    expect(captured?.method).toBe("DELETE");
    expect(deleted).toBe(true);
    expect(useExpertsStore.getState().experts).toEqual([]);
  });

  test("deleteExpert 失败返回 false 且列表不变", async () => {
    mockFetchOk({ experts: [sampleExpert] });
    await useExpertsStore.getState().fetchExperts();
    mockFetchError(500);
    const deleted = await useExpertsStore.getState().deleteExpert("ex-1");
    expect(deleted).toBe(false);
    expect(useExpertsStore.getState().experts).toHaveLength(1);
  });
});
