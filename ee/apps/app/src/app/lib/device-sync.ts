/**
 * Desktop-side device sync client for OpenWork multi-device synchronization.
 *
 * Provides device pairing, real-time session sync via SSE, presence tracking,
 * and offline change queuing with automatic reconnection.
 */

export type DeviceType = "desktop" | "mobile"

export type DeviceInfo = {
  id: string
  deviceType: DeviceType
  deviceName: string
  lastSeenAt: string
}

export type VectorClock = Record<string, number>

export type SyncChange = {
  id: string
  sessionId: string
  deviceId: string
  changeType: string
  payload: Record<string, unknown>
  version: number
  vectorClock: VectorClock
  createdAt: string
}

export type SessionPresence = {
  sessionId: string
  devices: Array<{
    deviceId: string
    deviceType: string
    lastSeen: string
    cursorPosition?: { messageId: string }
  }>
}

export type SyncEventHandler = (event: SyncChangeEvent) => void

export type SyncChangeEvent =
  | { type: "change"; change: SyncChange }
  | { type: "presence"; presence: SessionPresence }

type PendingChange = {
  changeType: string
  payload: Record<string, unknown>
  vectorClock: VectorClock
  enqueuedAt: number
}

type DeviceSyncOptions = {
  baseUrl: string
  getAuthToken: () => string | null
  deviceId: string
  deviceType: DeviceType
  deviceName: string
}

const MAX_PENDING_QUEUE = 1000
const RECONNECT_BASE_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 30_000
const HEARTBEAT_TIMEOUT_MS = 60_000

export class DeviceSyncClient {
  private baseUrl: string
  private getAuthToken: () => string | null
  private deviceId: string
  private deviceType: DeviceType
  private deviceName: string
  private pendingQueue: Map<string, PendingChange[]> = new Map()
  private eventHandlers: Map<string, Set<SyncEventHandler>> = new Map()
  private eventSources: Map<string, EventSource> = new Map()
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private reconnectDelays: Map<string, number> = new Map()
  private latestVersions: Map<string, number> = new Map()
  private disposed = false

  constructor(options: DeviceSyncOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "")
    this.getAuthToken = options.getAuthToken
    this.deviceId = options.deviceId
    this.deviceType = options.deviceType
    this.deviceName = options.deviceName
  }

  async registerDevice(): Promise<DeviceInfo> {
    const token = this.getAuthToken()
    if (!token) {
      throw new Error("Cannot register device: no auth token available")
    }

    const response = await fetch(`${this.baseUrl}/v1/devices/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        deviceId: this.deviceId,
        deviceType: this.deviceType,
        deviceName: this.deviceName,
      }),
    })

    if (!response.ok) {
      throw new Error(`Device registration failed: ${response.status}`)
    }

    return response.json() as Promise<DeviceInfo>
  }

  async initiatePairing(): Promise<{ code: string; expiresAt: string }> {
    const token = this.getAuthToken()
    if (!token) {
      throw new Error("Cannot initiate pairing: no auth token available")
    }

    const response = await fetch(`${this.baseUrl}/v1/devices/pair/initiate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Den-Device-Id": this.deviceId,
      },
      body: JSON.stringify({ deviceId: this.deviceId }),
    })

    if (!response.ok) {
      throw new Error(`Pairing initiation failed: ${response.status}`)
    }

    return response.json() as Promise<{ code: string; expiresAt: string }>
  }

  async completePairing(code: string): Promise<{ paired: boolean; pairedDeviceId: string; pairedUserId: string }> {
    const token = this.getAuthToken()
    if (!token) {
      throw new Error("Cannot complete pairing: no auth token available")
    }

    const response = await fetch(`${this.baseUrl}/v1/devices/pair/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Den-Device-Id": this.deviceId,
      },
      body: JSON.stringify({
        code,
        deviceId: this.deviceId,
        deviceType: this.deviceType,
        deviceName: this.deviceName,
      }),
    })

    if (!response.ok) {
      throw new Error(`Pairing completion failed: ${response.status}`)
    }

    return response.json() as Promise<{ paired: boolean; pairedDeviceId: string; pairedUserId: string }>
  }

  async listPairedDevices(): Promise<DeviceInfo[]> {
    const token = this.getAuthToken()
    if (!token) {
      throw new Error("Cannot list devices: no auth token available")
    }

    const response = await fetch(`${this.baseUrl}/v1/devices`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Den-Device-Id": this.deviceId,
      },
    })

    if (!response.ok) {
      throw new Error(`List devices failed: ${response.status}`)
    }

    const data = (await response.json()) as { devices: DeviceInfo[] }
    return data.devices
  }

  async unpairDevice(deviceId: string): Promise<void> {
    const token = this.getAuthToken()
    if (!token) {
      throw new Error("Cannot unpair device: no auth token available")
    }

    const response = await fetch(`${this.baseUrl}/v1/devices/${deviceId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Den-Device-Id": this.deviceId,
      },
      body: JSON.stringify({ deviceId }),
    })

    if (!response.ok) {
      throw new Error(`Unpair device failed: ${response.status}`)
    }
  }

  subscribeToSession(sessionId: string, handler: SyncEventHandler): () => void {
    let handlers = this.eventHandlers.get(sessionId)
    if (!handlers) {
      handlers = new Set()
      this.eventHandlers.set(sessionId, handlers)
    }
    handlers.add(handler)

    this.ensureConnected(sessionId)

    return () => {
      handlers?.delete(handler)
      if (handlers?.size === 0) {
        this.eventHandlers.delete(sessionId)
        this.disconnectSession(sessionId)
      }
    }
  }

  async pushLocalChange(
    sessionId: string,
    changeType: string,
    payload: Record<string, unknown>,
    vectorClock: VectorClock,
  ): Promise<{ id: string; version: number; createdAt: string }> {
    const token = this.getAuthToken()
    if (!token) {
      this.enqueuePendingChange(sessionId, { changeType, payload, vectorClock, enqueuedAt: Date.now() })
      throw new Error("Cannot push change: no auth token available (queued for retry)")
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/sessions/${sessionId}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Den-Device-Id": this.deviceId,
        },
        body: JSON.stringify({ changeType, payload, vectorClock }),
      })

      if (!response.ok) {
        this.enqueuePendingChange(sessionId, { changeType, payload, vectorClock, enqueuedAt: Date.now() })
        throw new Error(`Push change failed: ${response.status} (queued for retry)`)
      }

      return response.json() as Promise<{ id: string; version: number; createdAt: string }>
    } catch (error) {
      this.enqueuePendingChange(sessionId, { changeType, payload, vectorClock, enqueuedAt: Date.now() })
      throw error
    }
  }

  async pullChanges(sessionId: string, sinceVersion = 0): Promise<{ changes: SyncChange[]; latestVersion: number }> {
    const token = this.getAuthToken()
    if (!token) {
      throw new Error("Cannot pull changes: no auth token available")
    }

    const response = await fetch(`${this.baseUrl}/v1/sessions/${sessionId}/sync/pull`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Den-Device-Id": this.deviceId,
      },
      body: JSON.stringify({ sinceVersion }),
    })

    if (!response.ok) {
      throw new Error(`Pull changes failed: ${response.status}`)
    }

    return response.json() as Promise<{ changes: SyncChange[]; latestVersion: number }>
  }

  async updatePresence(
    sessionId: string,
    cursorPosition?: { messageId: string } | null,
  ): Promise<void> {
    const token = this.getAuthToken()
    if (!token) {
      return
    }

    const response = await fetch(`${this.baseUrl}/v1/sessions/${sessionId}/presence`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Den-Device-Id": this.deviceId,
      },
      body: JSON.stringify({ cursorPosition }),
    })

    if (!response.ok) {
      throw new Error(`Update presence failed: ${response.status}`)
    }
  }

  async getPresence(sessionId: string): Promise<SessionPresence> {
    const token = this.getAuthToken()
    if (!token) {
      throw new Error("Cannot get presence: no auth token available")
    }

    const response = await fetch(`${this.baseUrl}/v1/sessions/${sessionId}/presence`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Den-Device-Id": this.deviceId,
      },
    })

    if (!response.ok) {
      throw new Error(`Get presence failed: ${response.status}`)
    }

    return response.json() as Promise<SessionPresence>
  }

  async flushPendingChanges(sessionId: string): Promise<number> {
    const queue = this.pendingQueue.get(sessionId)
    if (!queue || queue.length === 0) {
      return 0
    }

    let flushed = 0
    while (queue.length > 0) {
      const pending = queue[0]
      try {
        await this.pushLocalChange(sessionId, pending.changeType, pending.payload, pending.vectorClock)
        queue.shift()
        flushed++
      } catch {
        break
      }
    }

    if (queue.length === 0) {
      this.pendingQueue.delete(sessionId)
    }

    return flushed
  }

  getPendingCount(sessionId: string): number {
    return this.pendingQueue.get(sessionId)?.length ?? 0
  }

  dispose(): void {
    this.disposed = true
    for (const sessionId of Array.from(this.eventSources.keys())) {
      this.disconnectSession(sessionId)
    }
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer)
    }
    this.reconnectTimers.clear()
  }

  private ensureConnected(sessionId: string): void {
    if (this.eventSources.has(sessionId) || this.disposed) {
      return
    }

    const token = this.getAuthToken()
    if (!token) {
      return
    }

    const url = `${this.baseUrl}/v1/sessions/${sessionId}/stream`
    const eventSource = new EventSource(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Den-Device-Id": this.deviceId,
      },
    })

    let lastHeartbeat = Date.now()

    eventSource.addEventListener("change", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as SyncChange
        this.latestVersions.set(sessionId, data.version)
        this.broadcastToSession(sessionId, { type: "change", change: data })
      } catch {
        // Ignore malformed events
      }
    })

    eventSource.addEventListener("presence", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as SessionPresence
        this.broadcastToSession(sessionId, { type: "presence", presence: data })
      } catch {
        // Ignore malformed events
      }
    })

    eventSource.addEventListener("heartbeat", () => {
      lastHeartbeat = Date.now()
    })

    eventSource.onopen = () => {
      this.reconnectDelays.set(sessionId, RECONNECT_BASE_DELAY_MS)
      void this.flushPendingChanges(sessionId)
    }

    eventSource.onerror = () => {
      eventSource.close()
      this.eventSources.delete(sessionId)

      if (Date.now() - lastHeartbeat < HEARTBEAT_TIMEOUT_MS) {
        this.scheduleReconnect(sessionId)
      }
    }

    this.eventSources.set(sessionId, eventSource)
  }

  private disconnectSession(sessionId: string): void {
    const existing = this.eventSources.get(sessionId)
    if (existing) {
      existing.close()
      this.eventSources.delete(sessionId)
    }
    const timer = this.reconnectTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.reconnectTimers.delete(sessionId)
    }
  }

  private scheduleReconnect(sessionId: string): void {
    if (this.disposed || this.eventSources.has(sessionId)) {
      return
    }

    const handlers = this.eventHandlers.get(sessionId)
    if (!handlers || handlers.size === 0) {
      return
    }

    const currentDelay = this.reconnectDelays.get(sessionId) ?? RECONNECT_BASE_DELAY_MS
    const nextDelay = Math.min(currentDelay * 2, RECONNECT_MAX_DELAY_MS)
    this.reconnectDelays.set(sessionId, nextDelay)

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(sessionId)
      this.ensureConnected(sessionId)
    }, currentDelay)

    this.reconnectTimers.set(sessionId, timer)
  }

  private broadcastToSession(sessionId: string, event: SyncChangeEvent): void {
    const handlers = this.eventHandlers.get(sessionId)
    if (!handlers) {
      return
    }
    for (const handler of handlers) {
      try {
        handler(event)
      } catch {
        // Ignore handler errors
      }
    }
  }

  private enqueuePendingChange(sessionId: string, pending: PendingChange): void {
    let queue = this.pendingQueue.get(sessionId)
    if (!queue) {
      queue = []
      this.pendingQueue.set(sessionId, queue)
    }
    if (queue.length >= MAX_PENDING_QUEUE) {
      queue.shift()
    }
    queue.push(pending)
  }
}

export function createDeviceSyncClient(options: DeviceSyncOptions): DeviceSyncClient {
  return new DeviceSyncClient(options)
}
