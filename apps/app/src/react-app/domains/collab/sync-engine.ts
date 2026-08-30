/**
 * WebSocket connection manager with auto-reconnect and event emission.
 * Pure TypeScript — no React dependencies.
 */

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface CursorUpdateMessage {
  type: 'cursor_update';
  position: { x: number; y: number };
  userId: string;
}

export interface DocumentChangeMessage {
  type: 'document_change';
  delta: unknown;
  version: number;
}

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
}

export interface PresenceMessage {
  type: 'presence';
  users: PresenceUser[];
}

export type SyncMessage = CursorUpdateMessage | DocumentChangeMessage | PresenceMessage;

export interface SyncEngineOptions {
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  jitterRange?: number;
}

type EventCallback = (message: SyncMessage) => void;

const DEFAULT_RECONNECT_DELAY = 1000; // 1 second
const DEFAULT_MAX_RECONNECT_DELAY = 30000; // 30 seconds
const DEFAULT_JITTER_RANGE = 500; // ±500ms

export class SyncEngine {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentReconnectDelay: number;
  private readonly options: Required<SyncEngineOptions>;

  constructor(options?: SyncEngineOptions) {
    this.options = {
      reconnectDelay: options?.reconnectDelay ?? DEFAULT_RECONNECT_DELAY,
      maxReconnectDelay: options?.maxReconnectDelay ?? DEFAULT_MAX_RECONNECT_DELAY,
      jitterRange: options?.jitterRange ?? DEFAULT_JITTER_RANGE,
    };
    this.currentReconnectDelay = this.options.reconnectDelay;
  }

  getState(): ConnectionState {
    return this.state;
  }

  connect(url: string): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.setState('connecting');

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.currentReconnectDelay = this.options.reconnectDelay;
        this.setState('connected');
      };

      this.ws.onclose = () => {
        this.setState('disconnected');
        this.scheduleReconnect(url);
      };

      this.ws.onerror = () => {
        this.setState('error');
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data as string) as SyncMessage;
          this.emit(message.type, message);
        } catch {
          // Ignore malformed messages
        }
      };
    } catch (error) {
      this.setState('error');
      this.scheduleReconnect(url);
    }
  }

  disconnect(): void {
    this.clearReconnectTimer();
    this.currentReconnectDelay = this.options.reconnectDelay;

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
  }

  sendMessage(message: SyncMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Cannot send message: not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  on(eventType: string, callback: EventCallback): void {
    let callbacks = this.listeners.get(eventType);
    if (!callbacks) {
      callbacks = new Set();
      this.listeners.set(eventType, callbacks);
    }
    callbacks.add(callback);
  }

  off(eventType: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.emit('state_change', { type: 'presence', users: [] } as unknown as SyncMessage);
    }
  }

  private scheduleReconnect(url: string): void {
    this.clearReconnectTimer();

    const delay = this.currentReconnectDelay + Math.random() * this.options.jitterRange * 2 - this.options.jitterRange;
    const clampedDelay = Math.min(delay, this.options.maxReconnectDelay);

    this.reconnectTimer = setTimeout(() => {
      this.currentReconnectDelay = Math.min(
        this.currentReconnectDelay * 2,
        this.options.maxReconnectDelay,
      );
      this.connect(url);
    }, clampedDelay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Emit an event to all registered listeners.
   * Exposed for testing purposes.
   */
  emit(eventType: string, message: SyncMessage): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(message);
        } catch {
          // Ignore listener errors to prevent cascade failures
        }
      }
    }
  }
}
