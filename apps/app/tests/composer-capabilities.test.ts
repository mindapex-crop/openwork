import { describe, expect, test } from "bun:test";

import {
  EMPTY_COMPOSER_CAPABILITIES,
  frameCapabilityPrompt,
  type CapabilityContext,
} from "../src/react-app/domains/session/surface/composer/composer-capabilities";

const NO_CAPABILITIES: CapabilityContext = { expert: null, connectorLabels: [] };

describe("EMPTY_COMPOSER_CAPABILITIES", () => {
  test("defaults to no expert and no connectors", () => {
    expect(EMPTY_COMPOSER_CAPABILITIES).toEqual({ expertId: null, connectorIds: [] });
  });
});

describe("frameCapabilityPrompt", () => {
  test("returns the prompt untouched when nothing is selected", () => {
    expect(frameCapabilityPrompt(NO_CAPABILITIES, "Write a report")).toBe("Write a report");
  });

  test("returns blank input untouched", () => {
    const context: CapabilityContext = {
      expert: { name: "周报助手", systemPrompt: "be terse" },
      connectorLabels: [],
    };
    expect(frameCapabilityPrompt(context, "")).toBe("");
    expect(frameCapabilityPrompt(context, "   ")).toBe("   ");
  });

  test("frames a selected expert with its system prompt", () => {
    const context: CapabilityContext = {
      expert: { name: "周报助手", systemPrompt: "汇总本周工作，输出中文要点。" },
      connectorLabels: [],
    };
    const framed = frameCapabilityPrompt(context, "帮我写周报");
    expect(framed.startsWith("帮我写周报")).toBe(true);
    expect(framed).toContain('You are acting as the expert "周报助手".');
    expect(framed).toContain("Expert instructions: 汇总本周工作，输出中文要点。");
  });

  test("omits the instructions line when system prompt is empty", () => {
    const context: CapabilityContext = {
      expert: { name: "无指令专家", systemPrompt: "   " },
      connectorLabels: [],
    };
    const framed = frameCapabilityPrompt(context, "hello");
    expect(framed).toContain('You are acting as the expert "无指令专家".');
    expect(framed).not.toContain("Expert instructions:");
  });

  test("turns bound skills into skill tokens", () => {
    const context: CapabilityContext = {
      expert: { name: "文档专家", systemPrompt: "x", skills: ["office-doc", "  ", "lark-im"] },
      connectorLabels: [],
    };
    const framed = frameCapabilityPrompt(context, "导出文档");
    expect(framed).toContain("Load [skill office-doc] and follow its instructions.");
    expect(framed).toContain("Load [skill lark-im] and follow its instructions.");
    expect(framed).not.toContain("Load [skill ]");
  });

  test("frames connector delivery targets", () => {
    const context: CapabilityContext = {
      expert: null,
      connectorLabels: ["飞书", "Slack"],
    };
    const framed = frameCapabilityPrompt(context, "整理会议纪要");
    expect(framed.startsWith("整理会议纪要")).toBe(true);
    expect(framed).toContain("Deliver the final result to these IM channels: 飞书, Slack.");
  });

  test("drops blank connector labels", () => {
    const context: CapabilityContext = { expert: null, connectorLabels: ["  "] };
    expect(frameCapabilityPrompt(context, "hello")).toBe("hello");
  });

  test("frames expert first, then connectors", () => {
    const context: CapabilityContext = {
      expert: { name: "周报助手", systemPrompt: "be terse" },
      connectorLabels: ["飞书"],
    };
    const framed = frameCapabilityPrompt(context, "写周报");
    expect(framed.indexOf("expert \"周报助手\"")).toBeLessThan(
      framed.indexOf("Deliver the final result"),
    );
  });

  test("is idempotent — never frames twice", () => {
    const context: CapabilityContext = {
      expert: { name: "周报助手", systemPrompt: "be terse" },
      connectorLabels: ["飞书"],
    };
    const once = frameCapabilityPrompt(context, "写周报");
    const twice = frameCapabilityPrompt(context, once);
    expect(twice).toBe(once);
    expect(twice.match(/You are acting as the expert/g)).toHaveLength(1);
  });

  test("trims surrounding whitespace before framing", () => {
    const context: CapabilityContext = { expert: null, connectorLabels: ["飞书"] };
    const framed = frameCapabilityPrompt(context, "  spaced  ");
    expect(framed.startsWith("spaced\n")).toBe(true);
  });
});
