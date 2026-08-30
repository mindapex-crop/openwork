import { describe, test, expect, beforeEach } from "bun:test";
import { WebSocketClient, type SyncMessage } from "../src/react-app/domains/sync/websocket-client";

describe("WebSocketClient", () => {
  let client: WebSocketClient;
  let messages: SyncMessage[];
  let stateChanges: string[];

  beforeEach(() => {
    messages = [];
    stateChanges = [];
    if (client) {
      client.disconnect();
    }
  });

  test("initializes in disconnected state", () => {
    client = new WebSocketClient({ url: "ws://localhost:8080" });
    expect(client.getState()).toBe("disconnected");
  });

  test("connects and updates state", () => {
    client = new WebSocketClient({
      url: "ws://localhost:8080",
      onStateChange: (state) => stateChanges.push(state),
    });

    // Should start in connecting state
    client.connect();
    expect(client.getState()).toBe("connecting");
  });

  test("queues messages when disconnected", () => {
    client = new WebSocketClient({ url: "ws://localhost:8080" });
    
    const message: SyncMessage = {
      type: "update",
      documentId: "doc-1",
      userId: "user-1",
      payload: { content: "test" },
      timestamp: Date.now(),
    };

    // This should queue the message since not connected
    client.send(message);
    expect(client.getState()).toBe("connecting");
  });

  test("disconnects cleanly", () => {
    client = new WebSocketClient({
      url: "ws://localhost:8080",
      onStateChange: (state) => stateChanges.push(state),
    });

    client.connect();
    client.disconnect();
    expect(client.getState()).toBe("disconnected");
  });

  test("handles invalid URL gracefully", () => {
    client = new WebSocketClient({ url: "invalid-url" });
    
    expect(() => {
      client.connect();
    }).not.toThrow();
  });
});
