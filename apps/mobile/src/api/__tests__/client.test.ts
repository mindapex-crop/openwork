import { ApiClient, ApiError } from "../client";
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

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});

describe("ApiClient", () => {
  it("拼接 base URL 与路径，去掉尾斜杠", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ApiClient({ ...config, serverUrl: "http://127.0.0.1:8787/" });
    await client.get("/experts");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("http://127.0.0.1:8787/experts");
  });

  it("query 参数正确编码并忽略空值", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { items: [] }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ApiClient(config);
    await client.get("/workspace/ws_x/sessions", {
      query: { limit: 20, search: "a b", start: undefined, roots: null },
    });

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("limit=20");
    // RN 的 URLSearchParams 将空格编码为 +（whatwg-url 行为）
    expect(url).toContain("search=a+b");
    expect(url).not.toContain("start");
    expect(url).not.toContain("roots");
  });

  it("POST 发送 JSON body 与 Content-Type", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(201, { item: { id: "s1" } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ApiClient(config);
    await client.post("/workspace/ws_x/sessions", { title: "T" });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({ title: "T" });
  });

  it("配置了 token 时发送 Authorization: Bearer", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, {}));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ApiClient({ ...config, bearerToken: "secret" });
    await client.get("/workspaces");

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: "Bearer secret" });
  });

  it("无 token 时不发送 Authorization 头", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, {}));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ApiClient(config);
    await client.get("/workspaces");

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("4xx 错误解析服务端 error/message 并抛出 ApiError", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(404, { error: "not_found", message: "Expert not found" })) as unknown as typeof fetch;

    const client = new ApiClient(config);
    const error = await client.get("/experts/nope").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).code).toBe("not_found");
    expect((error as ApiError).message).toBe("Expert not found");
  });

  it("网络失败映射为 status 0 network_error（离线容错）", async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError("Network request failed")) as unknown as typeof fetch;

    const client = new ApiClient(config);
    const error = await client.get("/experts").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).code).toBe("network_error");
    expect((error as ApiError).isNetworkError).toBe(true);
  });

  it("超时映射为 status 0 timeout", async () => {
    jest.useFakeTimers();
    globalThis.fetch = jest.fn((_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    }) as unknown as typeof fetch;

    const client = new ApiClient({ ...config, timeoutMs: 50 });
    const pending = client.get("/experts");
    jest.advanceTimersByTime(60);
    const error = await pending.catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).code).toBe("timeout");
  });

  it("updateConfig 使后续请求使用新地址", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ApiClient(config);
    client.updateConfig({ serverUrl: "http://example.com:9999" });
    await client.get("/experts");

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("http://example.com:9999/experts");
  });

  it("非 JSON 响应体（如纯文本）不抛解析错误", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response("plain text", { status: 200, headers: { "Content-Type": "text/plain" } }),
      ) as unknown as typeof fetch;

    const client = new ApiClient(config);
    const result = await client.get("/something");
    // 非 JSON 响应：client 不解析 body，返回 null（不抛错）
    expect(result).toBeNull();
  });
});
