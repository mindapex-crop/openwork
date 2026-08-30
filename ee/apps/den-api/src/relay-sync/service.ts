import { appLogger } from "../observability/logger.js"
import {
  appendChange,
  getChangesForSessions,
  getChangesSince,
  getLatestVersion,
  type RelaySyncChange,
  type VectorClock,
} from "./store.js"

const logger = appLogger.child({ component: "relay-sync" })

type SessionEvent =
  | { type: "change"; change: RelaySyncChange }
  | { type: "presence"; sessionId: string; devices: Array<{ deviceId: string; deviceType: string; lastSeen: string; cursorPosition?: { messageId: string } }> }

type SubscriptionCallback = (event: SessionEvent) => void

class RelaySyncService {
  private sessionSubscribers = new Map<string, Set<SubscriptionCallback>>()
  private subscriberSessions = new Map<SubscriptionCallback, Set<string>>()

  subscribeToSession(sessionId: string, callback: SubscriptionCallback): () => void {
    let subscribers = this.sessionSubscribers.get(sessionId)
    if (!subscribers) {
      subscribers = new Set()
      this.sessionSubscribers.set(sessionId, subscribers)
    }
    subscribers.add(callback)

    let sessions = this.subscriberSessions.get(callback)
    if (!sessions) {
      sessions = new Set()
      this.subscriberSessions.set(callback, sessions)
    }
    sessions.add(sessionId)

    return () => {
      subscribers?.delete(callback)
      if (subscribers?.size === 0) {
        this.sessionSubscribers.delete(sessionId)
      }
      sessions?.delete(sessionId)
      if (sessions?.size === 0) {
        this.subscriberSessions.delete(callback)
      }
    }
  }

  publishToSession(sessionId: string, event: SessionEvent): void {
    const subscribers = this.sessionSubscribers.get(sessionId)
    if (!subscribers || subscribers.size === 0) {
      return
    }

    for (const callback of subscribers) {
      try {
        callback(event)
      } catch (error) {
        logger.error("subscriber callback failed", { session_id: sessionId, error })
      }
    }
  }

  async relayChange(input: {
    sessionId: string
    deviceId: string
    changeType: string
    payload: Record<string, unknown>
    vectorClock: VectorClock
  }): Promise<RelaySyncChange> {
    const change = await appendChange(input)
    this.publishToSession(input.sessionId, { type: "change", change })
    return change
  }

  async changeLog(sessionId: string, sinceVersion: number, excludeDeviceId?: string): Promise<{
    changes: RelaySyncChange[]
    latestVersion: number
  }> {
    const [changes, latestVersion] = await Promise.all([
      getChangesSince({ sessionId, sinceVersion, excludeDeviceId }),
      getLatestVersion(sessionId),
    ])
    return { changes, latestVersion }
  }

  async syncSessions(input: {
    sessionIds: string[]
    sinceVersion: number
    excludeDeviceId?: string
  }): Promise<{
    changes: RelaySyncChange[]
    latestVersion: number
  }> {
    const changes = await getChangesForSessions(input)
    const versionPromises = input.sessionIds.map((id) => getLatestVersion(id))
    const versions = await Promise.all(versionPromises)
    const latestVersion = versions.length > 0 ? Math.max(...versions) : 0
    return { changes, latestVersion }
  }

  incrementalSync(sessionId: string, callback: SubscriptionCallback): () => void {
    return this.subscribeToSession(sessionId, callback)
  }

  getSubscriberCount(sessionId: string): number {
    return this.sessionSubscribers.get(sessionId)?.size ?? 0
  }

  hasSubscribers(sessionId: string): boolean {
    return (this.sessionSubscribers.get(sessionId)?.size ?? 0) > 0
  }
}

let serviceInstance: RelaySyncService | null = null

export function getRelaySyncService(): RelaySyncService {
  if (!serviceInstance) {
    serviceInstance = new RelaySyncService()
  }
  return serviceInstance
}

export type { RelaySyncService, SessionEvent, SubscriptionCallback }
