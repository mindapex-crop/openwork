/**
 * runtime-registry.e2e.test.ts — Runtime 上报层真实环境验证（openspec-runtime-reporting §5）
 *
 * 真实案例：本机 PATH 上存在 claude / codex / gemini / qwen / kimi / freebuff / opencode，
 * 验证 RuntimeRegistry 真实探测：list / get / deepProbe / invalidate 全部走真实 PATH。
 *
 * 运行: bun test src/runtime-registry.e2e.test.ts
 */

import { describe, expect, test } from "bun:test";
import { RuntimeRegistry, RUNTIME_REFRESH_TTL_MS } from "./runtime-registry.js";

// 本机真实存在的 CLI agents（2026-08-05 实测 PATH）
const REAL_AGENTS = ["claude", "codex", "gemini", "qwen", "kimi", "freebuff", "opencode"];

describe("RuntimeRegistry 真实环境（真实 PATH 探测）", () => {
  test("案例1: list() 探测到本机真实 CLI agents（available=true + 版本 + 路径）", async () => {
    const registry = new RuntimeRegistry({ ttlMs: 60_000 });
    const capabilities = await registry.list();

    // 本机真实 agents 中至少 claude-code/gemini/bash 被探测为可用
    const found = new Map(capabilities.map((c) => [c.agentId, c]));
    expect(found.size).toBeGreaterThan(10); // 60+ presets 全量上报
    for (const id of ["claude-code", "gemini", "bash"]) {
      const cap = found.get(id);
      expect(cap, `${id} 应被探测到`).toBeDefined();
      expect(cap!.available, `${id} 应 available=true`).toBe(true);
      expect(cap!.binaryPath, `${id} 应有绝对路径`).toBeTruthy();
    }
    // 结构完整性：每个条目都带 protocol/engine/declaredHeadless
    for (const cap of capabilities) {
      expect(typeof cap.protocol).toBe("string");
      expect(typeof cap.engine).toBe("string");
      expect(typeof cap.declaredHeadless).toBe("boolean");
    }
  }, 120_000);

  test("案例2: 全量 list() 中真实 agents 的版本/引擎/声明字段正确", async () => {
    const registry = new RuntimeRegistry({ ttlMs: 60_000 });
    const capabilities = await registry.list();
    const claude = capabilities.find((c) => c.agentId === "claude-code");
    const gemini = capabilities.find((c) => c.agentId === "gemini");

    expect(claude!.available).toBe(true);
    expect(claude!.version).toBeTruthy(); // claude 2.x 真实版本号
    expect(claude!.protocol).toBe("pty"); // preset 声明
    expect(claude!.engine).toBe("cli");
    expect(claude!.declaredHeadless).toBe(true); // claude 有 cliProfile.headless

    expect(gemini!.available).toBe(true);
    expect(gemini!.version).toBeTruthy();
  }, 120_000);

  test("案例3: get() 单 agent 深度探测（claude-code 真实 headless 能力）", async () => {
    const registry = new RuntimeRegistry({ ttlMs: 60_000 });
    const cap = await registry.get("claude-code");
    expect(cap).not.toBeNull();
    expect(cap!.available).toBe(true);
    // deepProbe：GenericCliSidecarAdapter 真实探测 → detected 存在（mode 至少 pty）
    expect(cap!.detected).toBeDefined();
    expect(["headless", "pty", "structured"].includes(cap!.detected!.mode)).toBe(true);
    // 若已登录则 headless 冒烟成功 → mode=headless + headlessArgs 模板
    if (cap!.detected!.mode === "headless") {
      expect(cap!.detected!.headlessArgs).toBeDefined();
      console.log(`[e2e] claude headless 冒烟成功: args=${JSON.stringify(cap!.detected!.headlessArgs)}`);
    }
  }, 60_000);

  test("案例4: get() 对不存在的 agent 返回 null（fail-fast 边界）", async () => {
    const registry = new RuntimeRegistry({ ttlMs: 60_000 });
    const cap = await registry.get("definitely-not-a-real-agent-xyz");
    expect(cap).toBeNull();
  });

  test("案例5: invalidate() 强制重扫返回新引用（真实 PATH）", async () => {
    const registry = new RuntimeRegistry({ ttlMs: 60_000 });
    const first = await registry.list();
    const cached = await registry.list(); // TTL 内命中缓存
    expect(cached).toBe(first);

    registry.invalidate();
    const second = await registry.list();
    expect(second).not.toBe(first);
    expect(second.length).toBe(first.length);
  }, 120_000);

  test("案例6: TTL 常量与并发去重（I1/I4）", async () => {
    expect(RUNTIME_REFRESH_TTL_MS).toBe(60_000);
    const registry = new RuntimeRegistry({ ttlMs: 60_000 });
    // 并发 list() 共享同一 in-flight refresh（不重复扫描）
    const [a, b] = await Promise.all([registry.list(), registry.list()]);
    expect(a).toBe(b);
  }, 120_000);
});
