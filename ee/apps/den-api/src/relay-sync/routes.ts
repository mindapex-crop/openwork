import { and, eq, gt, isNull } from "@openwork-ee/den-db/drizzle"
import { DeviceTable } from "@openwork-ee/den-db/schema"
import { normalizeDenTypeId } from "@openwork-ee/utils/typeid"
import type { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { stream } from "hono/streaming"
import { z } from "zod"
import { resolver } from "hono-openapi"
import { authenticatedRoute, jsonValidator, paramValidator } from "../middleware/index.js"
import { db } from "../db.js"
import { denTypeIdSchema, invalidRequestSchema, jsonResponse, unauthorizedSchema } from "../openapi.js"
import type { AuthContextVariables } from "../session.js"
import {
  getSessionPresence,
  removePresence,
  upsertPresence,
} from "./store.js"
import { getRelaySyncService } from "./service.js"

const syncPushSchema = z.object({
  changeType: z.string().trim().min(1).max(32),
  payload: z.record(z.string(), z.unknown()),
  vectorClock: z.record(z.string(), z.number().int().nonnegative()),
}).meta({ ref: "RelaySyncPushBody" })

const syncPushResponseSchema = z.object({
  id: denTypeIdSchema("relaySyncChange"),
  version: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
}).meta({ ref: "RelaySyncPushResponse" })

const syncPullSchema = z.object({
  sinceVersion: z.number().int().nonnegative().default(0),
  sessionIds: z.array(denTypeIdSchema("session")).optional(),
}).meta({ ref: "RelaySyncPullBody" })

const syncChangeSchema = z.object({
  id: denTypeIdSchema("relaySyncChange"),
  sessionId: denTypeIdSchema("session"),
  deviceId: denTypeIdSchema("device"),
  changeType: z.string(),
  payload: z.record(z.string(), z.unknown()),
  version: z.number().int().nonnegative(),
  vectorClock: z.record(z.string(), z.number().int().nonnegative()),
  createdAt: z.string().datetime(),
}).meta({ ref: "RelaySyncChangeEntry" })

const syncPullResponseSchema = z.object({
  changes: z.array(syncChangeSchema),
  latestVersion: z.number().int().nonnegative(),
}).meta({ ref: "RelaySyncPullResponse" })

const presenceResponseSchema = z.object({
  sessionId: denTypeIdSchema("session"),
  devices: z.array(z.object({
    deviceId: denTypeIdSchema("device"),
    deviceType: z.enum(["desktop", "mobile"]),
    lastSeen: z.string().datetime(),
    cursorPosition: z.object({ messageId: denTypeIdSchema("session") }).optional(),
  })),
}).meta({ ref: "SessionPresenceResponse" })

const presenceUpdateSchema = z.object({
  cursorPosition: z.object({ messageId: denTypeIdSchema("session") }).nullable().optional(),
}).meta({ ref: "SessionPresenceUpdateBody" })

const sseParamSchema = z.object({
  sessionId: denTypeIdSchema("session"),
}).meta({ ref: "SessionStreamParams" })

export function registerRelaySyncRoutes<T extends { Variables: AuthContextVariables }>(app: Hono<T>) {
  const service = getRelaySyncService()

  app.get(
    "/v1/sessions/:sessionId/stream",
    describeRoute({
      tags: ["Sync"],
      summary: "Stream session events via SSE",
      description: "Opens a Server-Sent Events stream that pushes real-time session changes and presence updates to connected devices.",
      responses: {
        200: {
          description: "SSE stream of session events.",
          content: {
            "text/event-stream": {
              schema: resolver(z.string()),
            },
          },
        },
        401: jsonResponse("The caller must be signed in to stream session events.", unauthorizedSchema),
      },
    }),
    authenticatedRoute(),
    paramValidator(sseParamSchema),
    async (c) => {
      const user = c.get("user")
      if (!user?.id) {
        return c.json({ error: "unauthorized" }, 401)
      }

      const { sessionId } = c.req.valid("param")
      const deviceId = c.req.header("x-den-device-id")?.trim()
      if (!deviceId) {
        return c.json({ error: "missing_device_id", message: "The X-Den-Device-Id header is required." }, 400)
      }

      const device = await db
        .select({ id: DeviceTable.id, deviceType: DeviceTable.deviceType })
        .from(DeviceTable)
        .where(eq(DeviceTable.id, normalizeDenTypeId("device", deviceId)))
        .limit(1)

      if (!device[0]) {
        return c.json({ error: "unknown_device", message: "Register this device before streaming." }, 403)
      }

      c.header("Content-Type", "text/event-stream")
      c.header("Cache-Control", "no-cache, no-transform")
      c.header("Connection", "keep-alive")
      c.header("X-Accel-Buffering", "no")

      return stream(c, async (s) => {
        let heartbeat: ReturnType<typeof setInterval> | undefined
        let cleanup: (() => void) | undefined

        const sendEvent = (event: string, data: unknown) => {
          s.write(`event: ${event}\n`)
          s.write(`data: ${JSON.stringify(data)}\n\n`)
        }

        try {
          cleanup = service.subscribeToSession(sessionId, (event) => {
            if (event.type === "change") {
              sendEvent("change", {
                id: event.change.id,
                sessionId: event.change.sessionId,
                deviceId: event.change.deviceId,
                changeType: event.change.changeType,
                payload: event.change.payload,
                version: event.change.version,
                vectorClock: event.change.vectorClock,
                createdAt: event.change.createdAt.toISOString(),
              })
            } else if (event.type === "presence") {
              sendEvent("presence", event)
            }
          })

          const presence = await getSessionPresence(sessionId)
          sendEvent("presence", {
            sessionId,
            devices: presence.map((p) => ({
              deviceId: p.deviceId,
              deviceType: p.deviceType,
              lastSeen: p.lastSeenAt.toISOString(),
              ...(p.cursorPosition ? { cursorPosition: p.cursorPosition } : {}),
            })),
          })

          heartbeat = setInterval(() => {
            s.write(`: heartbeat\n\n`)
          }, 30_000)

          s.onAbort(() => {
            if (heartbeat) {
              clearInterval(heartbeat)
            }
            if (cleanup) {
              cleanup()
            }
            void removePresence(sessionId, deviceId)
          })

          await new Promise<void>((resolve) => {
            s.onAbort(() => resolve())
          })
        } finally {
          if (heartbeat) {
            clearInterval(heartbeat)
          }
          if (cleanup) {
            cleanup()
          }
          void removePresence(sessionId, deviceId)
        }
      })
    },
  )

  app.post(
    "/v1/sessions/:sessionId/sync",
    describeRoute({
      tags: ["Sync"],
      summary: "Push local changes to a session",
      description: "Pushes a local change to the session change log. The change is broadcast to all devices subscribed to the session stream.",
      responses: {
        200: jsonResponse("Change accepted and broadcast.", syncPushResponseSchema),
        400: jsonResponse("The sync push body was invalid.", invalidRequestSchema),
        401: jsonResponse("The caller must be signed in to push changes.", unauthorizedSchema),
      },
    }),
    authenticatedRoute(),
    paramValidator(sseParamSchema),
    jsonValidator(syncPushSchema),
    async (c) => {
      const user = c.get("user")
      if (!user?.id) {
        return c.json({ error: "unauthorized" }, 401)
      }

      const { sessionId } = c.req.valid("param")
      const input = c.req.valid("json")
      const deviceId = c.req.header("x-den-device-id")?.trim()
      if (!deviceId) {
        return c.json({ error: "missing_device_id", message: "The X-Den-Device-Id header is required." }, 400)
      }

      const device = await db
        .select({ id: DeviceTable.id })
        .from(DeviceTable)
        .where(
          and(
            eq(DeviceTable.id, normalizeDenTypeId("device", deviceId)),
            eq(DeviceTable.userId, normalizeDenTypeId("user", user.id)),
          ),
        )
        .limit(1)

      if (!device[0]) {
        return c.json({ error: "unknown_device", message: "This device is not registered to the current user." }, 403)
      }

      const change = await service.relayChange({
        sessionId,
        deviceId,
        changeType: input.changeType,
        payload: input.payload,
        vectorClock: input.vectorClock,
      })

      return c.json({
        id: change.id,
        version: change.version,
        createdAt: change.createdAt.toISOString(),
      })
    },
  )

  app.post(
    "/v1/sessions/:sessionId/sync/pull",
    describeRoute({
      tags: ["Sync"],
      summary: "Pull session changes since a version",
      description: "Returns all changes to a session since the given version. Use this for offline devices to catch up after reconnecting.",
      responses: {
        200: jsonResponse("Changes returned successfully.", syncPullResponseSchema),
        400: jsonResponse("The sync pull body was invalid.", invalidRequestSchema),
        401: jsonResponse("The caller must be signed in to pull changes.", unauthorizedSchema),
      },
    }),
    authenticatedRoute(),
    paramValidator(sseParamSchema),
    jsonValidator(syncPullSchema),
    async (c) => {
      const user = c.get("user")
      if (!user?.id) {
        return c.json({ error: "unauthorized" }, 401)
      }

      const { sessionId } = c.req.valid("param")
      const input = c.req.valid("json")
      const deviceId = c.req.header("x-den-device-id")?.trim()

      const { changes, latestVersion } = await service.changeLog(
        sessionId,
        input.sinceVersion,
        deviceId,
      )

      return c.json({
        changes: changes.map((change) => ({
          id: change.id,
          sessionId: change.sessionId,
          deviceId: change.deviceId,
          changeType: change.changeType,
          payload: change.payload,
          version: change.version,
          vectorClock: change.vectorClock,
          createdAt: change.createdAt.toISOString(),
        })),
        latestVersion,
      })
    },
  )

  app.get(
    "/v1/sessions/:sessionId/presence",
    describeRoute({
      tags: ["Sync"],
      summary: "Get session presence",
      description: "Returns the list of devices currently viewing a session.",
      responses: {
        200: jsonResponse("Session presence returned successfully.", presenceResponseSchema),
        401: jsonResponse("The caller must be signed in to read presence.", unauthorizedSchema),
      },
    }),
    authenticatedRoute(),
    paramValidator(sseParamSchema),
    async (c) => {
      const user = c.get("user")
      if (!user?.id) {
        return c.json({ error: "unauthorized" }, 401)
      }

      const { sessionId } = c.req.valid("param")
      const presence = await getSessionPresence(sessionId)

      return c.json({
        sessionId,
        devices: presence.map((p) => ({
          deviceId: p.deviceId,
          deviceType: p.deviceType as "desktop" | "mobile",
          lastSeen: p.lastSeenAt.toISOString(),
          ...(p.cursorPosition ? { cursorPosition: p.cursorPosition } : {}),
        })),
      })
    },
  )

  app.put(
    "/v1/sessions/:sessionId/presence",
    describeRoute({
      tags: ["Sync"],
      summary: "Update session presence",
      description: "Updates the caller's presence in a session, including optional cursor position.",
      responses: {
        200: jsonResponse("Presence updated successfully.", z.object({ ok: z.literal(true) }).meta({ ref: "PresenceUpdateResponse" })),
        400: jsonResponse("The presence update body was invalid.", invalidRequestSchema),
        401: jsonResponse("The caller must be signed in to update presence.", unauthorizedSchema),
      },
    }),
    authenticatedRoute(),
    paramValidator(sseParamSchema),
    jsonValidator(presenceUpdateSchema),
    async (c) => {
      const user = c.get("user")
      if (!user?.id) {
        return c.json({ error: "unauthorized" }, 401)
      }

      const { sessionId } = c.req.valid("param")
      const input = c.req.valid("json")
      const deviceId = c.req.header("x-den-device-id")?.trim()
      if (!deviceId) {
        return c.json({ error: "missing_device_id", message: "The X-Den-Device-Id header is required." }, 400)
      }

      const device = await db
        .select({ deviceType: DeviceTable.deviceType })
        .from(DeviceTable)
        .where(
          and(
            eq(DeviceTable.id, normalizeDenTypeId("device", deviceId)),
            eq(DeviceTable.userId, normalizeDenTypeId("user", user.id)),
          ),
        )
        .limit(1)

      if (!device[0]) {
        return c.json({ error: "unknown_device", message: "This device is not registered to the current user." }, 403)
      }

      await upsertPresence({
        sessionId,
        deviceId,
        deviceType: device[0].deviceType,
        cursorPosition: input.cursorPosition,
      })

      const presence = await getSessionPresence(sessionId)
      service.publishToSession(sessionId, {
        type: "presence",
        sessionId,
        devices: presence.map((p) => ({
          deviceId: p.deviceId,
          deviceType: p.deviceType,
          lastSeen: p.lastSeenAt.toISOString(),
          ...(p.cursorPosition ? { cursorPosition: p.cursorPosition } : {}),
        })),
      })

      return c.json({ ok: true })
    },
  )
}
