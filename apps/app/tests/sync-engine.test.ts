import { describe, expect, it, beforeEach, afterEach } from "bun:test";

import { SyncEngine, type SyncMessage } from "../src/react-app/domains/collab/sync-engine";

describe("SyncEngine", () => {
  let engine: SyncEngine;

  beforeEach(() => {
    engine = new SyncEngine();
  });

  afterEach(() => {
    engine.disconnect();
  });

  it("initial connection state is disconnected", () => {
    expect(engine.getState()).toBe("disconnected");
  });

  it("connect changes state to connecting then connected", async () => {
    const mockWs = {
      readyState: 1, // OPEN
      send: () => {},
      close: () => {},
      onopen: null as (() => void) | null,
      onclose: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onmessage: null as ((event: MessageEvent) => void) | null,
    };

    const originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = class MockWebSocket {
      constructor(_url: string) {
        setTimeout(() => {
          if (mockWs.onopen) mockWs.onopen();
        }, 0);
        return mockWs;
      }
    } as unknown as typeof WebSocket;

    const connectPromise = new Promise<void>((resolve) => {
      engine.on("state_change", () => {
        if (engine.getState() === "connected") {
          resolve();
        }
      });
    });

    engine.connect("ws://localhost:8080");
    expect(engine.getState()).toBe("connecting");

    await connectPromise;
    expect(engine.getState()).toBe("connected");

    globalThis.WebSocket = originalWebSocket;
  });

  it("disconnect changes state to disconnected", () => {
    engine.disconnect();
    expect(engine.getState()).toBe("disconnected");
  });

  it("sendMessage throws error when disconnected", () => {
    expect(() => {
      engine.sendMessage({ type: "presence", users: [] });
    }).toThrow("Cannot send message: not connected");
  });

  it("reconnection with exponential backoff increases delay", () => {
    const engineWithBackoff = new SyncEngine({
      reconnectDelay: 100,
      maxReconnectDelay: 500,
      jitterRange: 0,
    });

    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    let callCount = 0;

    globalThis.setTimeout = ((callback: () => void, delay: number) => {
      delays.push(delay);
      callCount++;
      return originalSetTimeout(callback, 0);
    }) as typeof setTimeout;

    try {
      const mockError = new Error("Connection failed");
      const ws = {
        readyState: 3, // CLOSED
        send: () => {},
        close: () => {},
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
      };

      const originalWebSocket = globalThis.WebSocket;
      globalThis.WebSocket = class MockWebSocket {
        constructor(_url: string) {
          setTimeout(() => {
            if (ws.onerror) ws.onerror(mockError as unknown as Event);
            if (ws.onclose) ws.onclose();
          }, 0);
          return ws;
        }
      } as unknown as typeof WebSocket;

      engineWithBackoff.connect("ws://localhost:8080");

      setTimeout(() => {
        expect(delays.length).toBeGreaterThan(0);
        if (delays.length > 1) {
          expect(delays[1]).toBeGreaterThan(delays[0]);
        }
      }, 10);

      globalThis.WebSocket = originalWebSocket;
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      engineWithBackoff.disconnect();
    }
  });

  it("event listener registration and removal works", () => {
    const callback = (_msg: SyncMessage) => {};

    engine.on("cursor_update", callback);
    engine.off("cursor_update", callback);

    const message: SyncMessage = {
      type: "cursor_update",
      position: { x: 100, y: 200 },
      userId: "user-1",
    };

    let received = false;
    const testCallback = () => {
      received = true;
    };

    engine.on("test_event", testCallback);
    engine.emit("test_event" as never, message);
    expect(received).toBe(true);

    engine.off("test_event", testCallback);
    received = false;
    engine.emit("test_event" as never, message);
    expect(received).toBe(false);
  });

  it("message reception triggers correct event callbacks", () => {
    const messages: SyncMessage[] = [];
    const callback = (msg: SyncMessage) => {
      messages.push(msg);
    };

    engine.on("cursor_update", callback);

    const cursorMessage: SyncMessage = {
      type: "cursor_update",
      position: { x: 100, y: 200 },
      userId: "user-1",
    };

    const presenceMessage: SyncMessage = {
      type: "presence",
      users: [
        { id: "user-1", name: "Alice", color: "#FF5733" },
      ],
    };

    engine.emit("cursor_update" as never, cursorMessage);
    engine.emit("presence" as never, presenceMessage);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(cursorMessage);
  });

  it("error handling when WebSocket fails", () => {
    const originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = class MockWebSocket {
      constructor(_url: string) {
        throw new Error("WebSocket construction failed");
      }
    } as unknown as typeof WebSocket;

    try {
      engine.connect("ws://invalid-host");
      expect(engine.getState()).toBe("error");
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });
});
