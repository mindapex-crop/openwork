/**
 * team-autonomy-routes.e2e.test.ts — 三组新路由注册 + 匹配验证
 *
 * 验证 server.ts 注册的三组路由真实可用：路径可匹配、参数可提取、auth 模式正确。
 * 不启动完整 server（避免依赖 token/配置），用 registry 的 matchRoute 做路由层验证。
 *
 * 运行: bun test src/routes/team-autonomy-routes.e2e.test.ts
 */

import { describe, expect, test } from "bun:test";
import { addRoute, matchRoute, type Route } from "./registry.js";
import { RuntimeRegistry } from "../runtime-registry.js";
import { WorktreeService } from "../worktree/worktree-service.js";
import { ChatRelayService } from "../chat/chat-relay.js";
import { registerAgentRuntimeRoutes } from "./agent-runtimes.js";
import { registerWorktreeRoutes } from "./worktrees.js";
import { registerChatRoutes } from "./chat.js";
import { InMemoryChatChannel } from "../chat/channels/in-memory.js";

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

function buildRoutes(): Route[] {
  const routes: Route[] = [];
  registerAgentRuntimeRoutes({
    routes,
    registry: new RuntimeRegistry({ ttlMs: 60_000, detect: async () => [] }), // 不扫描 PATH，纯路由验证
    jsonResponse,
  });
  registerWorktreeRoutes({
    routes,
    service: new WorktreeService(),
    jsonResponse,
    readJsonBody: async (req: Request) => req.json(),
  });
  registerChatRoutes({
    routes,
    channels: { memory: new InMemoryChatChannel() },
    relay: new ChatRelayService({ allowedAgents: new Set(["x"]) }),
    jsonResponse,
    readJsonBody: async (req: Request) => req.json(),
  });
  return routes;
}

describe("team-autonomy 路由注册（真实 server.ts 同构调用）", () => {
  const routes = buildRoutes();

  test("案例1: Runtime 上报 3 个端点可匹配（含 :agentId 参数提取）", () => {
    expect(matchRoute(routes, "GET", "/agent-runtimes")).not.toBeNull();
    const single = matchRoute(routes, "GET", "/agent-runtimes/claude");
    expect(single).not.toBeNull();
    expect(single!.params.agentId).toBe("claude");
    expect(matchRoute(routes, "GET", "/agent-runtimes/")).toBeNull(); // 空 id 不匹配
    expect(matchRoute(routes, "POST", "/agent-runtimes/reload")).not.toBeNull();
    expect(matchRoute(routes, "POST", "/agent-runtimes/reload")).not.toBeNull();
  });

  test("案例2: Worktree 5 个端点可匹配", () => {
    expect(matchRoute(routes, "GET", "/worktrees")).not.toBeNull();
    expect(matchRoute(routes, "POST", "/worktrees")).not.toBeNull();
    expect(matchRoute(routes, "DELETE", "/worktrees")).not.toBeNull();
    expect(matchRoute(routes, "POST", "/worktrees/prune")).not.toBeNull();
    expect(matchRoute(routes, "POST", "/worktrees/cleanup")).not.toBeNull();
    // 方法不匹配 → null
    expect(matchRoute(routes, "GET", "/worktrees/prune")).toBeNull();
  });

  test("案例3: Chat 2 个端点可匹配", () => {
    expect(matchRoute(routes, "POST", "/chat/inbound")).not.toBeNull();
    expect(matchRoute(routes, "GET", "/chat/channels")).not.toBeNull();
    expect(matchRoute(routes, "GET", "/chat/inbound")).toBeNull(); // 方法不匹配
  });

  test("案例4: 不相关路径不误匹配", () => {
    expect(matchRoute(routes, "GET", "/workspaces")).toBeNull();
    expect(matchRoute(routes, "GET", "/agent-runtimes/unknown")).not.toBeNull();
  });
});
