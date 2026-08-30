import "./_setup/localstorage";
import { afterEach, describe, expect, test, mock } from "bun:test";

import {
  IM_CONNECTOR_DEFINITIONS,
  useImConnectorStore,
} from "../src/react-app/domains/settings/im-connector-store";

const originalFetch = globalThis.fetch;

function resetStore() {
  useImConnectorStore.setState({
    states: useImConnectorStore.getState().states.map((s) => ({ ...s, status: "disconnected" as const })),
    phase: "idle",
    error: null,
    connection: null,
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetStore();
});

describe("IM_CONNECTOR_DEFINITIONS", () => {
  test("contains all 5 IM platforms", () => {
    const ids = IM_CONNECTOR_DEFINITIONS.map((d) => d.id).sort();
    expect(ids).toEqual(["dingtalk", "discord", "feishu", "slack", "wecom"]);
  });

  test("each definition has name, description, icon, and accent", () => {
    for (const def of IM_CONNECTOR_DEFINITIONS) {
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.icon).toBeDefined();
      expect(def.accent.length).toBeGreaterThan(0);
    }
  });
});

describe("useImConnectorStore", () => {
  test("initial state has all platforms as disconnected", () => {
    const { states, phase } = useImConnectorStore.getState();
    expect(phase).toBe("idle");
    expect(states.length).toBe(5);
    expect(states.every((s) => s.status === "disconnected")).toBe(true);
  });

  test("refresh with no connection sets phase to ready", async () => {
    mock.module("../src/react-app/shell/openwork-connection", () => ({
      resolveOpenworkConnection: async () => ({
        normalizedBaseUrl: "",
        resolvedToken: "",
        resolvedHostToken: "",
        hostInfo: null,
        source: "empty" as const,
      }),
    }));

    await useImConnectorStore.getState().refresh();
    expect(useImConnectorStore.getState().phase).toBe("ready");
  });

  test("refresh maps server configs to states", async () => {
    mock.module("../src/react-app/shell/openwork-connection", () => ({
      resolveOpenworkConnection: async () => ({
        normalizedBaseUrl: "http://localhost:3000",
        resolvedToken: "test-token",
        resolvedHostToken: "",
        hostInfo: null,
        source: "stored-settings" as const,
      }),
    }));

    globalThis.fetch = mock(async (url: string) => {
      if (String(url).includes("/api/chat-channels")) {
        return new Response(
          JSON.stringify({
            channels: [
              { channelId: "feishu", webhookUrl: "https://hook.example.com/feishu", connected: true, enabled: true, updatedAt: new Date().toISOString() },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    await useImConnectorStore.getState().refresh();

    const { states, phase, connection } = useImConnectorStore.getState();
    expect(phase).toBe("ready");
    expect(connection).toEqual({ baseUrl: "http://localhost:3000", token: "test-token" });

    const feishu = states.find((s) => s.id === "feishu");
    expect(feishu).toBeDefined();
    expect(feishu?.status).toBe("connected");
  });

  test("refresh handles fetch error gracefully", async () => {
    mock.module("../src/react-app/shell/openwork-connection", () => ({
      resolveOpenworkConnection: async () => ({
        normalizedBaseUrl: "http://localhost:3000",
        resolvedToken: "test-token",
        resolvedHostToken: "",
        hostInfo: null,
        source: "stored-settings" as const,
      }),
    }));

    globalThis.fetch = mock(async () => {
      throw new Error("network error");
    }) as typeof fetch;

    await useImConnectorStore.getState().refresh();

    const { phase, error } = useImConnectorStore.getState();
    expect(phase).toBe("error");
    expect(error).toBe("Failed to load connectors");
  });

  test("disconnect sets status to disconnected optimistically", async () => {
    useImConnectorStore.setState({
      connection: { baseUrl: "http://localhost:3000", token: "test-token" },
      states: useImConnectorStore.getState().states.map((s) =>
        s.id === "feishu" ? { ...s, status: "connected" as const } : s,
      ),
    });

    globalThis.fetch = mock(async () => {
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    await useImConnectorStore.getState().disconnect("feishu");

    const feishu = useImConnectorStore.getState().states.find((s) => s.id === "feishu");
    expect(feishu?.status).toBe("disconnected");
  });

  test("connect transitions state through connecting to connected", async () => {
    useImConnectorStore.setState({
      connection: { baseUrl: "http://localhost:3000", token: "test-token" },
    });

    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          channel: { channelId: "slack", webhookUrl: "https://hook.example.com/slack", connected: true },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    await useImConnectorStore.getState().connect("slack", "https://hook.example.com/slack");

    const slack = useImConnectorStore.getState().states.find((s) => s.id === "slack");
    expect(slack?.status).toBe("connected");
  });

  test("connect rolls back on failure", async () => {
    useImConnectorStore.setState({
      connection: { baseUrl: "http://localhost:3000", token: "test-token" },
    });

    globalThis.fetch = mock(async () => {
      return new Response("error", { status: 500 });
    }) as typeof fetch;

    await useImConnectorStore.getState().connect("discord", "https://bad-url.example.com");

    const discord = useImConnectorStore.getState().states.find((s) => s.id === "discord");
    expect(discord?.status).toBe("disconnected");
    expect(useImConnectorStore.getState().error).toBe("Connection failed");
  });
});
