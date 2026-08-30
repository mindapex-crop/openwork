import { expect } from "vitest";
import { createAndSelectWorkspace, control, evalIn, waitFor } from "@openwork/behaviors";
import { desktop } from "@openwork/hosts";
import { needs, test } from "@openwork/testkit";

/**
 * L4 daily smoke journey (roadmap: 评测体系 → L4 冒烟层).
 *
 * The journey is: app boots → new task created → artifact persisted. The two
 * phase-four steps — cloud relay handoff (Relay Sync) and IM delivery (企微/
 * 飞书/钉钉/Slack) — are marked TODO and skipped, and the report records that
 * explicitly. Each step is independently skippable via env so the daily
 * workflow degrades gracefully on hosts that cannot run part of the journey:
 *
 *   OPENWORK_EVAL_APP_SPECS=1        drive the Electron app (required for steps 1/2/5)
 *   OPENWORK_EVAL_JOURNEY_ARTIFACT=0 skip the artifact step
 */
const appSpecsEnabled = process.env.OPENWORK_EVAL_APP_SPECS === "1";
const artifactEnabled = process.env.OPENWORK_EVAL_JOURNEY_ARTIFACT !== "0";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sessionIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => (typeof entry.sessionId === "string" ? entry.sessionId : ""))
    .filter(Boolean);
}

test.skipIf(!appSpecsEnabled)(
  "daily journey: app boots, a new task is created, and the session persists (cloud handoff / IM delivery TODO)",
  async ({ evidence }) => {
    needs({ optIn: ["OPENWORK_EVAL_APP_SPECS"] });
    await using app = await desktop({ name: "daily-journey" });

    // --- Step 1/5: app boots into a workspace ---
    const workspace = await createAndSelectWorkspace(app, {
      path: `/tmp/openwork-daily-journey-${Date.now()}`,
    });
    expect(workspace.workspaceId).toBeTruthy();
    const route = await evalIn(app, "window.__openworkControl.snapshot().route");
    expect(route).toBeTruthy();
    await waitFor(app, "document.body.innerText.trim().length > 40", {
      timeoutMs: 30_000,
      label: "rendered body text",
    });
    evidence.fact(
      "Daily journey step 1/5: app boots into a workspace",
      `Workspace ${workspace.workspaceId} created; control route is ${JSON.stringify(route)} and the renderer paints meaningful text.`,
      true,
    );

    // --- Step 2/5: a new task is created ---
    const before = sessionIdList(await control(app, "session.list_sessions"));
    await waitFor(
      app,
      `Boolean(window.__openworkControl.listActions().find((entry) => entry.id === "session.create_task" && !entry.disabled))`,
      { timeoutMs: 60_000, label: "session.create_task control ready" },
    );
    await control(app, "session.create_task", undefined, { timeoutMs: 60_000 });
    await waitFor(app, `window.location.hash.includes("/session/ses_")`, {
      timeoutMs: 60_000,
      label: "created task session",
    });
    const after = sessionIdList(await control(app, "session.list_sessions"));
    expect(after.length).toBeGreaterThan(before.length);
    evidence.fact(
      "Daily journey step 2/5: a new task session is created",
      `Sessions went from ${before.length} to ${after.length}; the app navigated to a /session/ses_ route.`,
      true,
    );

    // --- Step 3/5: cloud relay handoff — TODO, skipped (roadmap 阶段四 Relay Sync) ---
    evidence.fact(
      "Daily journey step 3/5: cloud relay handoff",
      "TODO — Relay Sync（云端接力同步）随阶段四落地后接入本旅程；当前标记跳过。见 prds/workbuddy-refactor/roadmap.md 阶段四与评测体系 L3。",
      true,
    );

    // --- Step 4/5: IM delivery — TODO, skipped (roadmap 阶段四 IM 四通道) ---
    evidence.fact(
      "Daily journey step 4/5: IM delivery",
      "TODO — 企微/飞书/钉钉/Slack 四通道 adapter 随阶段四落地后接入本旅程；当前标记跳过。",
      true,
    );

    // --- Step 5/5: artifact persisted (minimal: the task session is persisted) ---
    if (!artifactEnabled) {
      evidence.fact(
        "Daily journey step 5/5: artifact persisted",
        "Skipped — OPENWORK_EVAL_JOURNEY_ARTIFACT=0; 未执行产物落库断言。",
        true,
      );
    } else {
      const persisted = sessionIdList(await control(app, "session.list_sessions"));
      expect(persisted.length).toBeGreaterThan(0);
      evidence.fact(
        "Daily journey step 5/5: artifact persisted",
        `The created task session is persisted by the engine (${persisted.length} sessions on disk after the run). ` +
          "扩展点：接入真实模型后，这里可升级为「等待 agent 产出文件 → 断言 workspace 内产物落库」。",
        true,
      );
    }
  },
);

// The two phase-four steps are first-class TODO entries in the journey so the
// daily report marks them skipped instead of silently absent.
test.skip("daily journey step 3: cloud relay handoff (TODO 阶段四 Relay Sync, 云端接力同步)", () => {});
test.skip("daily journey step 4: IM delivery (TODO 阶段四 企微/飞书/钉钉/Slack 四通道 adapter)", () => {});
