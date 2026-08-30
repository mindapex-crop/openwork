import { afterEach, describe, expect, test } from "bun:test";
import {
  fetchRelayStatus,
  normalizeRelaySyncStatus,
  postRelayEvent,
} from "../src/react-app/domains/relay/relay-store";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetchOnce(response: { status: number; body: unknown }): void {
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

describe("normalizeRelaySyncStatus", () => {
  test("normalizes a valid status payload", () => {
    expect(
      normalizeRelaySyncStatus({
        threadId: "ses_1",
        localVersion: 3,
        remoteVersion: 2,
        pendingCount: 1,
        sentCount: 4,
        lastSyncedAt: 1710000000000,
        lastSyncDirection: "pull",
        relayEventCount: 2,
        updatedAt: 1710000001000,
      }),
    ).toEqual({
      threadId: "ses_1",
      localVersion: 3,
      remoteVersion: 2,
      pendingCount: 1,
      sentCount: 4,
      lastSyncedAt: 1710000000000,
      lastSyncDirection: "pull",
      relayEventCount: 2,
      updatedAt: 1710000001000,
    });
  });

  test("rejects payloads without a thread id", () => {
    expect(normalizeRelaySyncStatus({ localVersion: 1 })).toBeNull();
    expect(normalizeRelaySyncStatus(null)).toBeNull();
    expect(normalizeRelaySyncStatus("nope")).toBeNull();
  });

  test("coerces missing numeric fields to safe defaults", () => {
    expect(normalizeRelaySyncStatus({ threadId: "ses_1" })).toMatchObject({
      threadId: "ses_1",
      localVersion: 0,
      remoteVersion: 0,
      pendingCount: 0,
      lastSyncDirection: null,
    });
  });
});

describe("fetchRelayStatus", () => {
  test("requests the status endpoint and returns a normalized status", async () => {
    let requestedUrl = "";
    let requestedHeaders: Record<string, string> = {};
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      requestedHeaders = (init?.headers as Record<string, string>) ?? {};
      return new Response(
        JSON.stringify({
          threadId: "ses_1",
          localVersion: 5,
          remoteVersion: 5,
          pendingCount: 0,
          sentCount: 5,
          lastSyncedAt: 1710000000000,
          lastSyncDirection: "push",
          relayEventCount: 1,
          updatedAt: 1710000001000,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const status = await fetchRelayStatus("http://localhost:8787/", "ses_1", { token: "tok" });
    expect(status.localVersion).toBe(5);
    expect(status.pendingCount).toBe(0);
    expect(requestedUrl).toBe("http://localhost:8787/api/relay-sync/ses_1/status");
    expect(requestedHeaders.Authorization).toBe("Bearer tok");
  });

  test("throws on a non-200 response", async () => {
    mockFetchOnce({ status: 404, body: { code: "not_found" } });
    await expect(fetchRelayStatus("http://localhost:8787", "ses_1")).rejects.toThrow(/404/);
  });
});

describe("postRelayEvent", () => {
  test("POSTs the relay event and returns the result", async () => {
    let requestedUrl = "";
    let requestedMethod = "";
    let requestedBody = "";
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      requestedMethod = init?.method ?? "GET";
      requestedBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({ threadId: "ses_1", version: 3, note: "cloud handoff", relayedAt: 1710000000000 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const result = await postRelayEvent("http://localhost:8787", "ses_1", "cloud handoff", { token: "tok" });
    expect(result).toEqual({ version: 3, note: "cloud handoff", relayedAt: 1710000000000 });
    expect(requestedUrl).toBe("http://localhost:8787/api/relay-sync/ses_1/relay");
    expect(requestedMethod).toBe("POST");
    expect(JSON.parse(requestedBody)).toEqual({ note: "cloud handoff" });
  });

  test("throws when the relay endpoint fails", async () => {
    mockFetchOnce({ status: 403, body: { code: "forbidden" } });
    await expect(postRelayEvent("http://localhost:8787", "ses_1")).rejects.toThrow(/403/);
  });
});
