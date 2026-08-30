import { ApiClient } from "../client";
import { sessionsApi } from "../sessions";
import type { AppConfig } from "../../config";

const config: AppConfig = {
  serverUrl: "http://127.0.0.1:8787",
  workspaceId: "",
  bearerToken: "",
  timeoutMs: 5000,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function lastFetch(): { url: string; init: RequestInit } {
  const call = (globalThis.fetch as jest.Mock).mock.calls.at(-1) as [string, RequestInit];
  return { url: call[0], init: call[1] };
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("sessionsApi", () => {
  it("resolveWorkspaceId 优先使用显式 workspaceId", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ApiClient(config);
    const id = await sessionsApi.resolveWorkspaceId(client, "ws_configured");

    expect(id).toBe("ws_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolveWorkspaceId 无显式 id 时从 GET /workspaces 探测 activeId", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(200, {
          items: [{ id: "ws_1", name: "A" }],
          activeId: "ws_active",
        }),
      ) as unknown as typeof fetch;

    const client = new ApiClient(config);
    const id = await sessionsApi.resolveWorkspaceId(client);

    expect(id).toBe("ws_active");
    expect(lastFetch().url).toBe("http://127.0.0.1:8787/workspaces");
  });

  it("resolveWorkspaceId 无 activeId 时回退第一个 item", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { items: [{ id: "ws_1", name: "A" }], activeId: null })) as unknown as typeof fetch;

    const client = new ApiClient(config);
    expect(await sessionsApi.resolveWorkspaceId(client)).toBe("ws_1");
  });

  it("resolveWorkspaceId 无任何工作区时抛错", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { items: [], activeId: null })) as unknown as typeof fetch;

    const client = new ApiClient(config);
    await expect(sessionsApi.resolveWorkspaceId(client)).rejects.toThrow("No workspace available");
  });

  it("list 请求 GET /workspace/:id/sessions 并携带 query", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { items: [] })) as unknown as typeof fetch;

    const client = new ApiClient(config);
    const items = await sessionsApi.list(client, "ws_x", { limit: 20, search: "hi" });

    expect(items).toEqual([]);
    const { url } = lastFetch();
    expect(url).toBe("http://127.0.0.1:8787/workspace/ws_x/sessions?limit=20&search=hi");
  });

  it("create 请求 POST /workspace/:id/sessions 并返回 { item, started }", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(201, { item: { id: "s1", title: "T" }, started: true })) as unknown as typeof fetch;

    const client = new ApiClient(config);
    const result = await sessionsApi.create(client, "ws_x", { title: "T", prompt: "hello" });

    expect(result.item.id).toBe("s1");
    const { url, init } = lastFetch();
    expect(url).toBe("http://127.0.0.1:8787/workspace/ws_x/sessions");
    expect(JSON.parse(String(init.body))).toEqual({ title: "T", prompt: "hello" });
  });

  it("get 请求 GET /workspace/:id/sessions/:sid 并解包 item", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { item: { id: "s1" } })) as unknown as typeof fetch;

    const client = new ApiClient(config);
    const session = await sessionsApi.get(client, "ws_x", "s1");

    expect(session.id).toBe("s1");
    expect(lastFetch().url).toBe("http://127.0.0.1:8787/workspace/ws_x/sessions/s1");
  });

  it("messages 请求 GET .../messages 并解包 items", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { items: [] })) as unknown as typeof fetch;

    const client = new ApiClient(config);
    await sessionsApi.messages(client, "ws_x", "s1", { limit: 50 });

    expect(lastFetch().url).toBe("http://127.0.0.1:8787/workspace/ws_x/sessions/s1/messages?limit=50");
  });

  it("sendMessage 走 opencode prompt_async 代理（TODO 联调契约）", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ApiClient(config);
    await sessionsApi.sendMessage(client, "ws_x", "s1", "hi there");

    const { url, init } = lastFetch();
    expect(url).toBe("http://127.0.0.1:8787/workspace/ws_x/opencode/session/s1/prompt_async");
    expect(JSON.parse(String(init.body))).toEqual({ parts: [{ type: "text", text: "hi there" }] });
  });
});
