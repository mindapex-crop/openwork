import { afterEach, describe, expect, mock, test } from "bun:test";

import { useExpertsStore } from "../src/react-app/domains/experts/experts-store";
import {
  resolveCapabilityContext,
  hasComposerCapabilities,
  useComposerCapabilityStore,
} from "../src/react-app/domains/session/surface/composer/composer-capability-store";
import type { Expert } from "../src/react-app/domains/experts/types";

function expert(overrides: Partial<Expert> & { id: string }): Expert {
  return {
    name: overrides.id,
    description: "",
    systemPrompt: "",
    methodology: "",
    skills: [],
    ...overrides,
  };
}

afterEach(() => {
  useComposerCapabilityStore.getState().clear();
  useExpertsStore.setState({ experts: [], status: "idle", error: null });
});

describe("useComposerCapabilityStore", () => {
  test("starts empty", () => {
    const state = useComposerCapabilityStore.getState();
    expect(state.expertId).toBeNull();
    expect(state.connectorIds).toEqual([]);
    expect(hasComposerCapabilities()).toBe(false);
  });

  test("setExpert selects and clears a single expert", () => {
    useComposerCapabilityStore.getState().setExpert("weekly");
    expect(useComposerCapabilityStore.getState().expertId).toBe("weekly");
    expect(hasComposerCapabilities()).toBe(true);

    useComposerCapabilityStore.getState().setExpert(null);
    expect(useComposerCapabilityStore.getState().expertId).toBeNull();
  });

  test("toggleConnector adds then removes", () => {
    const toggle = useComposerCapabilityStore.getState().toggleConnector;
    toggle("feishu");
    toggle("slack");
    expect(useComposerCapabilityStore.getState().connectorIds).toEqual(["feishu", "slack"]);

    useComposerCapabilityStore.getState().toggleConnector("feishu");
    expect(useComposerCapabilityStore.getState().connectorIds).toEqual(["slack"]);
  });

  test("expert and connector selections do not clobber each other", () => {
    useComposerCapabilityStore.getState().setExpert("weekly");
    useComposerCapabilityStore.getState().toggleConnector("feishu");
    useComposerCapabilityStore.getState().setExpert("other");

    const state = useComposerCapabilityStore.getState();
    expect(state.expertId).toBe("other");
    expect(state.connectorIds).toEqual(["feishu"]);
  });

  test("clear resets both selections", () => {
    useComposerCapabilityStore.getState().setExpert("weekly");
    useComposerCapabilityStore.getState().toggleConnector("feishu");
    useComposerCapabilityStore.getState().clear();
    expect(hasComposerCapabilities()).toBe(false);
  });
});

describe("resolveCapabilityContext", () => {
  test("resolves expert fields from the experts store", () => {
    useExpertsStore.setState({
      experts: [expert({ id: "weekly", name: "周报助手", systemPrompt: "汇总本周", skills: ["office-doc"] })],
      status: "ready",
    });
    useComposerCapabilityStore.getState().setExpert("weekly");

    const context = resolveCapabilityContext();
    expect(context.expert).toEqual({
      name: "周报助手",
      systemPrompt: "汇总本周",
      skills: ["office-doc"],
    });
  });

  test("falls back to null when the selected expert no longer exists", () => {
    useComposerCapabilityStore.getState().setExpert("deleted-expert");
    expect(resolveCapabilityContext().expert).toBeNull();
  });

  test("maps connector ids to platform labels", () => {
    useComposerCapabilityStore.getState().toggleConnector("feishu");
    useComposerCapabilityStore.getState().toggleConnector("slack");
    // 标签改走 i18n 后按当前 locale 解析；本套测试默认 en。
    expect(resolveCapabilityContext().connectorLabels).toEqual(["Feishu", "Slack"]);
  });

  test("keeps unknown connector ids as-is instead of dropping them", () => {
    useComposerCapabilityStore.getState().toggleConnector("teams");
    expect(resolveCapabilityContext().connectorLabels).toEqual(["teams"]);
  });
});

mock.module("../src/react-app/shell/openwork-connection", () => ({
  resolveOpenworkConnection: async () => null,
  resolveServerApiBaseUrl: async () => "",
}));
