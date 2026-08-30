/**
 * Marketplace —— Connectors 视图投影纯逻辑测试（org 连接 + 快捷连接目录 + 模型 Provider）。
 */
import { describe, expect, test } from "bun:test";

import { buildConnectorView } from "../src/react-app/domains/marketplace/marketplace-page";

const orgConnections = [
  { id: "notion", name: "Notion", connected: true, needsReconnect: false },
  { id: "google-workspace", name: "Google Workspace", connected: true, needsReconnect: true },
];

const catalog = [
  { id: "notion", name: "Notion", description: "Notion MCP", iconSrc: "/ext-notion.svg" },
  { id: "linear", name: "Linear", description: "Linear MCP", iconSrc: "/ext-linear.svg" },
];

const providers = [
  { id: "anthropic", name: "Anthropic" },
  { id: "openai", name: "OpenAI" },
];

describe("buildConnectorView 投影", () => {
  test("已连接的 org 连接进入 connected 分组", () => {
    const view = buildConnectorView({ orgConnections, catalog, providers });
    const notion = view.mcpConnected.find((item) => item.id === "notion");
    expect(notion).toBeDefined();
    expect(notion?.status).toBe("connected");
    expect(notion?.source).toBe("org");
  });

  test("需要重连的连接进入 needsReconnect 分组", () => {
    const view = buildConnectorView({ orgConnections, catalog, providers });
    const gws = view.mcpNeedsReconnect.find((item) => item.id === "google-workspace");
    expect(gws).toBeDefined();
    expect(gws?.status).toBe("needs_reconnect");
  });

  test("未匹配 org 连接的目录条目进入 available 分组（真实可连接端点）", () => {
    const view = buildConnectorView({ orgConnections, catalog, providers });
    const linear = view.mcpAvailable.find((item) => item.id === "linear");
    expect(linear).toBeDefined();
    expect(linear?.status).toBe("available");
    expect(linear?.description).toBe("Linear MCP");
  });

  test("目录中已被 org 连接覆盖的条目不会重复出现在 available 分组", () => {
    const view = buildConnectorView({ orgConnections, catalog, providers });
    expect(view.mcpAvailable.find((item) => item.id === "notion")).toBeUndefined();
  });

  test("providers 分组包含全部内置 provider", () => {
    const view = buildConnectorView({ orgConnections, catalog, providers });
    expect(view.providers.map((p) => p.id).sort()).toEqual(["anthropic", "openai"]);
    expect(view.providers.every((p) => p.kind === "provider")).toBe(true);
  });

  test("空输入返回空分组", () => {
    const view = buildConnectorView({ orgConnections: [], catalog: [], providers: [] });
    expect(view.mcpConnected).toEqual([]);
    expect(view.mcpNeedsReconnect).toEqual([]);
    expect(view.mcpAvailable).toEqual([]);
    expect(view.providers).toEqual([]);
  });
});
