import { describe, expect, test } from "bun:test";

import {
  frameTaskPrompt,
  resolveTaskModeVariant,
  type TaskMode,
} from "../src/react-app/domains/session/chat/task-mode";

describe("resolveTaskModeVariant", () => {
  test("ask mode preserves the existing fallback variant (no override)", () => {
    expect(resolveTaskModeVariant("ask", null)).toBeNull();
    expect(resolveTaskModeVariant("ask", "balanced")).toBe("balanced");
    expect(resolveTaskModeVariant("ask", "reasoning")).toBe("reasoning");
  });

  test("craft mode always returns balanced regardless of current fallback", () => {
    expect(resolveTaskModeVariant("craft", null)).toBe("balanced");
    expect(resolveTaskModeVariant("craft", "balanced")).toBe("balanced");
    expect(resolveTaskModeVariant("craft", "reasoning")).toBe("balanced");
  });

  test("plan mode always returns reasoning", () => {
    expect(resolveTaskModeVariant("plan", null)).toBe("reasoning");
    expect(resolveTaskModeVariant("plan", "balanced")).toBe("reasoning");
    expect(resolveTaskModeVariant("plan", "fast")).toBe("reasoning");
  });

  test("exhaustive mode coverage — no silent default fallthrough", () => {
    const modes: TaskMode[] = ["ask", "craft", "plan"];
    for (const mode of modes) {
      // Every mode must return a deterministic value (not undefined).
      const value = resolveTaskModeVariant(mode, null);
      expect(value === null || typeof value === "string").toBe(true);
    }
  });
});

describe("frameTaskPrompt", () => {
  test("ask mode appends the read-only framing (WorkBuddy 问一问只读对标)", () => {
    const framed = frameTaskPrompt("ask", "What is the capitol of France?");
    expect(framed.startsWith("What is the capitol of France?")).toBe(true);
    expect(framed).toContain("read-only");
    expect(framed).toContain("Do NOT modify files");
    expect(frameTaskPrompt("ask", "  hello  ").startsWith("hello")).toBe(true);
  });

  test("empty or whitespace-only prompts return empty string for all modes (no framing wrappers)", () => {
    expect(frameTaskPrompt("ask", "")).toBe("");
    expect(frameTaskPrompt("ask", "   ")).toBe("");
    expect(frameTaskPrompt("craft", "")).toBe("");
    expect(frameTaskPrompt("craft", "\n\t")).toBe("");
    expect(frameTaskPrompt("plan", "")).toBe("");
    expect(frameTaskPrompt("plan", "  \n  ")).toBe("");
  });

  test("craft mode appends the implementation-first framing", () => {
    const framed = frameTaskPrompt("craft", "Refactor utils.ts");
    expect(framed.startsWith("Refactor utils.ts")).toBe(true);
    expect(framed).toContain("short plan");
    expect(framed).toContain("smallest change");
  });

  test("plan mode appends the no-execution, structured plan framing", () => {
    const framed = frameTaskPrompt("plan", "Build a Slack webhook integration");
    expect(framed.startsWith("Build a Slack webhook integration")).toBe(true);
    expect(framed).toContain("Do not start executing yet");
    expect(framed).toContain("step-by-step plan");
    expect(framed).toContain("wait for me to confirm");
  });

  test("framing preserves the user's original content including newlines and unicode", () => {
    const raw = "实现飞书机器人\n- 接收消息\n- 回复通知";
    const framedCraft = frameTaskPrompt("craft", raw);
    expect(framedCraft.startsWith(raw)).toBe(true);
    const framedPlan = frameTaskPrompt("plan", raw);
    expect(framedPlan.startsWith(raw)).toBe(true);
  });

  test("trimming happens before framing so leading/trailing whitespace doesn't leak", () => {
    const framed = frameTaskPrompt("plan", "  do the thing  ");
    expect(framed.startsWith(" ")).toBe(false);
    expect(framed).toContain("do the thing");
  });

  test("framing is idempotent-ish: framing an already-framed prompt still starts with the raw content", () => {
    const once = frameTaskPrompt("plan", "Build X");
    const twice = frameTaskPrompt("plan", once);
    // Second pass trims and re-frames, so the wrapper appears once more but
    // the raw content is still at the start.
    expect(twice.startsWith("Build X")).toBe(true);
    expect(twice.match(/Do not start executing yet/g)?.length).toBe(2);
  });

  test("all modes handle a complex realistic prompt with markdown and code blocks", () => {
    const prompt = "Fix this:\n```ts\nconst x: any = 1;\n```\nMake it typed.";
    const askFramed = frameTaskPrompt("ask", prompt);
    expect(askFramed.startsWith(prompt)).toBe(true);
    expect(askFramed).toContain("read-only");
    const craftFramed = frameTaskPrompt("craft", prompt);
    expect(craftFramed.startsWith(prompt)).toBe(true);
    const planFramed = frameTaskPrompt("plan", prompt);
    expect(planFramed.startsWith(prompt)).toBe(true);
  });

  test("超长 prompt（10KB）正常处理不截断", () => {
    const longPrompt = "A".repeat(10_000);
    const askResult = frameTaskPrompt("ask", longPrompt);
    expect(askResult.startsWith(longPrompt)).toBe(true);
    expect(askResult.length).toBeGreaterThan(10_000);
    const craftResult = frameTaskPrompt("craft", longPrompt);
    expect(craftResult.startsWith(longPrompt)).toBe(true);
    expect(craftResult.length).toBeGreaterThan(10_000);
  });

  test("prompt 仅含换行和制表符返回空字符串", () => {
    expect(frameTaskPrompt("ask", "\n\t\r\n")).toBe("");
    expect(frameTaskPrompt("craft", "\n\t")).toBe("");
    expect(frameTaskPrompt("plan", "\r\n")).toBe("");
  });

  test("prompt 含特殊字符（HTML/XML 标签）正常保留", () => {
    const prompt = "Remove <div class=\"old\"> from component";
    const framed = frameTaskPrompt("craft", prompt);
    expect(framed).toContain("<div class=\"old\">");
  });

  test("prompt 含 emoji 正常处理", () => {
    const prompt = "修复这个 🐛 bug 🤖";
    expect(frameTaskPrompt("ask", prompt).startsWith(prompt)).toBe(true);
    expect(frameTaskPrompt("ask", prompt)).toContain("read-only");
    expect(frameTaskPrompt("craft", prompt).startsWith(prompt)).toBe(true);
    expect(frameTaskPrompt("plan", prompt).startsWith(prompt)).toBe(true);
  });

  test("resolveTaskModeVariant + frameTaskPrompt 组合使用：plan 模式返回 reasoning + plan framing", () => {
    const variant = resolveTaskModeVariant("plan", null);
    expect(variant).toBe("reasoning");
    const framed = frameTaskPrompt("plan", "Build feature X");
    expect(framed).toContain("Do not start executing yet");
    // 确认两者可以安全组合
    expect(typeof variant === "string").toBe(true);
    expect(framed.length).toBeGreaterThan("Build feature X".length);
  });

  test("resolveTaskModeVariant + frameTaskPrompt 组合使用：ask 模式保持默认变体 + 只读 framing", () => {
    const variant = resolveTaskModeVariant("ask", "balanced");
    expect(variant).toBe("balanced");
    const framed = frameTaskPrompt("ask", "Quick question");
    expect(framed.startsWith("Quick question")).toBe(true);
    expect(framed).toContain("read-only");
  });
});
