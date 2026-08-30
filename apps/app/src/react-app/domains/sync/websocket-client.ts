/**
 * WebSocket client for real-time collaboration sync
 * Manages connection lifecycle, message queuing, and reconnection logic
 */

export type SyncMessage = {
  type: "update" | "presence" | "cursor";
  documentId: string;
  userId: string;
  payload: unknown;
  timestamp: number;
};

type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

interface WebSocketClientOptions {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (message: SyncMessage) => void;
  onStateChange?: (state: ConnectionState) => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private options: WebSocketClientOptions;
  private state: ConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private messageQueue: SyncMessage[] = [];
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(options: WebSocketClientOptions) {
    this.options = {
      reconnectInterval: options.reconnectInterval ?? 3000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      ...options,
    };
  }

  connect(): void {
    if (this.state === "connected" || this.state === "connecting") {
      return;
    }

    this.setState(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    try {
      this.ws = new WebSocket(this.options.url);

      this.ws.onopen = () => {
        this.setState("connected");
        this.reconnectAttempts = 0;
        this.flushMessageQueue();
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as SyncMessage;
          this.options.onMessage?.(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      this.ws.onclose = () => {
        this.stopPing();
        this.setState("disconnected");
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState("disconnected");
    this.reconnectAttempts = this.options.maxReconnectAttempts ?? 5; // Prevent auto-reconnect
  }

  send(message: SyncMessage): void {
    if (this.state === "connected" && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
      if (this.state === "disconnected") {
        this.connect();
      }
    }
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.options.onStateChange?.(state);
  }

  private scheduleReconnect(): void {
    const maxAttempts = this.options.maxReconnectAttempts ?? 5;
    if (this.reconnectAttempts >= maxAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.options.reconnectInterval ?? 3000;

    setTimeout(() => {
      if (this.state !== "connected") {
        this.connect();
      }
    }, delay);
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
      }
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  getState(): ConnectionState {
    return this.state;
  }
}
