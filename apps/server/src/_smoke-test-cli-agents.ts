#!/usr/bin/env bun
// CLI agent 集成冒烟测试：探测 PATH 上的 CLI agent → 通过进程池 acquire/release 验证
// 每个 agent 的 acquire 硬超时 5s，超时强杀（不会卡住整个测试）

import {
  createAdapterForAgent,
  detectAllAgents,
  getGlobalSidecarPool,
  resolveExecutionMode,
  selectPresetForAgent,
  resetGlobalSidecarPool,
  type PooledSidecarHandle,
} from "./agent-sidecar/index.js";
import { setTimeout } from "node:timers/promises";

const DEFAULT_ACQUIRE_TIMEOUT_MS = 5000;

async function withTimeout<T>(
  label: string,
  timeoutMs: number,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => setTimeout(timeoutMs).then(() => reject(new Error(`timeout ${timeoutMs}ms`)))),
    ]);
  } catch (err: any) {
    console.log(`    [TIMEOUT] ${label}: ${err.message}`);
    return fallback;
  }
}

async function main(): Promise<void> {
  console.log("\n========== CLI agent smoke test (长连接优先 + 进程池) ==========\n");

  const available = await detectAllAgents();
  const availableIds = available
    .filter((r) => r.available)
    .map((r) => r.agentId)
    .sort();

  console.log(`[detect] PATH 可用 CLI agent (${availableIds.length}): ${availableIds.join(", ") || "(none)"}`);
  if (availableIds.length === 0) {
    console.warn("[skip] 无可用 agent");
    return;
  }

  const pool = resetGlobalSidecarPool({
    ptyConcurrency: 4,
    acpConcurrency: 4,
    httpPerAgentConcurrency: 2,
    mcpConcurrency: 2,
    minIdleTimeoutMs: 5000,
    maxIdleTimeoutMs: 10000,
    orphanScanIntervalMs: 1000,
    forceKillGraceMs: 1500,
  });

  const results: Array<{ agentId: string; protocol: string; execMode: string; ok: boolean; reason: string; spawned: number }> = [];

  for (const agentId of availableIds) {
    try {
      const preset = selectPresetForAgent(agentId);
      const execMode = resolveExecutionMode(preset);
      const adapter = createAdapterForAgent(agentId);

      console.log(`\n--- [${agentId}] protocol=${preset.protocol} execMode=${execMode} binary=${preset.binary} ---`);

      const detect = await adapter.detect();
      if (!detect.available) {
        console.log(`    [SKIP] detect.available=false`);
        results.push({ agentId, protocol: preset.protocol, execMode, ok: false, reason: "detect unavailable", spawned: 0 });
        continue;
      }
      console.log(`    [detect] OK  ${detect.binaryPath} v${detect.version || "-"}`);

      const before = { ...pool.getMetrics() };

      // acquire 加硬超时（用 preset.startupTimeoutMs，默认 5s）
      const acquireTimeout = (preset.startupTimeoutMs ?? DEFAULT_ACQUIRE_TIMEOUT_MS) + 1000;
      const handle = await withTimeout<PooledSidecarHandle>(
        "acquire",
        acquireTimeout,
        () =>
          pool.acquire(
            adapter,
            { cwd: process.cwd(), timeoutMs: 3000 },
            { keyFn: () => `${preset.protocol}:${preset.agentId}:${process.cwd()}` },
          ),
        null as any,
      );

      if (!handle) {
        const after = { ...pool.getMetrics() };
        results.push({ agentId, protocol: preset.protocol, execMode, ok: false, reason: "acquire timeout", spawned: after.spawned - before.spawned });
        continue;
      }

      const after = { ...pool.getMetrics() };
      const alive = handle.inner.isAlive();
      const transport = handle.inner.transportInfo;
      console.log(`    [acquire] OK  pid=${handle.inner.processId ?? "-"}  cmd="${transport.command} ${transport.args.join(" ")}"  alive=${alive}  pool.spawned=${after.spawned}`);

      await setTimeout(200);

      // release 也加硬超时
      const releaseOk = await withTimeout<boolean>("release", 3000, () => pool.release(handle, { evict: true }).then(() => true).catch(() => false), false);
      const final = { ...pool.getMetrics() };
      console.log(`    [release] evict=${true}  releaseOk=${releaseOk}  active=${final.active} idle=${final.idle} leaked=${final.leaked}`);

      results.push({ agentId, protocol: preset.protocol, execMode, ok: releaseOk, reason: alive ? "alive-after-release-check" : "dead-before-release", spawned: after.spawned - before.spawned });
    } catch (err: any) {
      console.log(`    [FAIL] 整体抛错: ${err.message}`);
      results.push({ agentId, protocol: "?", execMode: "?", ok: false, reason: err.message, spawned: 0 });
    }
  }

  console.log("\n\n========== 结果汇总 ==========");
  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  console.log(`OK=${ok.length}  FAIL=${fail.length}  TOTAL=${results.length}`);
  for (const r of fail) console.log(`  ✗ ${r.agentId} [${r.protocol}/${r.execMode}]: ${r.reason}`);
  for (const r of ok) console.log(`  ✓ ${r.agentId} [${r.protocol}/${r.execMode}]`);

  console.log("\n[pool final metrics] " + JSON.stringify(pool.getMetrics()));
  await pool.dispose();
  console.log("[done] pool disposed");
}

main().catch((err) => { console.error("[FATAL]", err); process.exit(1); });
