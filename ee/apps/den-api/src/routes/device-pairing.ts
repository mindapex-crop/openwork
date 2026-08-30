import { and, eq, gt, isNull, or } from "@openwork-ee/den-db/drizzle"
import { DevicePairingCodeTable, DeviceTable } from "@openwork-ee/den-db/schema"
import { createDenTypeId, normalizeDenTypeId } from "@openwork-ee/utils/typeid"
import { randomInt } from "node:crypto"
import type { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { z } from "zod"
import { appLogger } from "../observability/logger.js"
import { authenticatedRoute, jsonValidator, publicRoute } from "../middleware/index.js"
import { db } from "../db.js"
import { denTypeIdSchema, invalidRequestSchema, jsonResponse, notFoundSchema, unauthorizedSchema } from "../openapi.js"
import type { AuthContextVariables } from "../session.js"
import { enforceRateLimit } from "../utils/rate-limit.js"

const logger = appLogger.child({ component: "device-pairing" })

const PAIRING_CODE_TTL_MS = 5 * 60 * 1000
const PAIRING_CODE_LENGTH = 6

const DEVICE_TYPES = ["desktop", "mobile"] as const

function generatePairingCode(): string {
  const min = 100_000
  const max = 999_999
  return String(randomInt(min, max + 1))
}

const registerDeviceSchema = z.object({
  deviceId: denTypeIdSchema("device"),
  deviceType: z.enum(DEVICE_TYPES),
  deviceName: z.string().trim().min(1).max(255),
}).meta({ ref: "RegisterDeviceBody" })

const registerDeviceResponseSchema = z.object({
  id: denTypeIdSchema("device"),
  deviceType: z.enum(DEVICE_TYPES),
  deviceName: z.string(),
  lastSeenAt: z.string().datetime(),
}).meta({ ref: "RegisterDeviceResponse" })

const initiatePairingSchema = z.object({
  deviceId: denTypeIdSchema("device"),
}).meta({ ref: "InitiatePairingBody" })

const initiatePairingResponseSchema = z.object({
  code: z.string().length(PAIRING_CODE_LENGTH),
  expiresAt: z.string().datetime(),
}).meta({ ref: "InitiatePairingResponse" })

const completePairingSchema = z.object({
  code: z.string().length(PAIRING_CODE_LENGTH),
  deviceId: denTypeIdSchema("device"),
  deviceType: z.enum(DEVICE_TYPES),
  deviceName: z.string().trim().min(1).max(255),
}).meta({ ref: "CompletePairingBody" })

const completePairingResponseSchema = z.object({
  paired: z.literal(true),
  pairedDeviceId: denTypeIdSchema("device"),
  pairedUserId: denTypeIdSchema("user"),
}).meta({ ref: "CompletePairingResponse" })

const listDevicesResponseSchema = z.object({
  devices: z.array(z.object({
    id: denTypeIdSchema("device"),
    deviceType: z.enum(DEVICE_TYPES),
    deviceName: z.string(),
    lastSeenAt: z.string().datetime(),
  })),
}).meta({ ref: "ListPairedDevicesResponse" })

const unpairDeviceSchema = z.object({
  deviceId: denTypeIdSchema("device"),
}).meta({ ref: "UnpairDeviceBody" })

const unpairDeviceResponseSchema = z.object({
  ok: z.literal(true),
}).meta({ ref: "UnpairDeviceResponse" })

const rateLimitedSchema = z.object({
  error: z.literal("rate_limited"),
  message: z.string(),
}).meta({ ref: "DevicePairingRateLimitedError" })

const invalidCodeSchema = z.object({
  error: z.enum(["invalid_code", "expired_code", "already_used"]),
  message: z.string(),
}).meta({ ref: "DevicePairingCodeError" })

export function registerDevicePairingRoutes<T extends { Variables: AuthContextVariables }>(app: Hono<T>) {
  app.post(
    "/v1/devices/register",
    describeRoute({
      tags: ["Devices"],
      summary: "Register a device for the current user",
      description: "Registers or updates a device associated with the authenticated user. Returns the device record.",
      responses: {
        200: jsonResponse("Device registered successfully.", registerDeviceResponseSchema),
        400: jsonResponse("The device registration body was invalid.", invalidRequestSchema),
        401: jsonResponse("The caller must be signed in to register a device.", unauthorizedSchema),
      },
    }),
    authenticatedRoute(),
    jsonValidator(registerDeviceSchema),
    async (c) => {
      const user = c.get("user")
      if (!user?.id) {
        return c.json({ error: "unauthorized" }, 401)
      }

      const input = c.req.valid("json")
      const normalizedUserId = normalizeDenTypeId("user", user.id)
      const normalizedDeviceId = normalizeDenTypeId("device", input.deviceId)

      const now = new Date()
      const existing = await db
        .select({
          id: DeviceTable.id,
          deviceType: DeviceTable.deviceType,
          deviceName: DeviceTable.deviceName,
          lastSeenAt: DeviceTable.lastSeenAt,
        })
        .from(DeviceTable)
        .where(eq(DeviceTable.id, normalizedDeviceId))
        .limit(1)

      if (existing[0]) {
        if (existing[0].deviceType !== input.deviceType) {
          return c.json({ error: "device_type_mismatch", message: "Device ID already exists with a different type." }, 400)
        }

        await db
          .update(DeviceTable)
          .set({ deviceName: input.deviceName, lastSeenAt: now })
          .where(eq(DeviceTable.id, normalizedDeviceId))

        return c.json({
          id: normalizedDeviceId,
          deviceType: input.deviceType,
          deviceName: input.deviceName,
          lastSeenAt: now.toISOString(),
        })
      }

      await db.insert(DeviceTable).values({
        id: normalizedDeviceId,
        userId: normalizedUserId,
        deviceType: input.deviceType,
        deviceName: input.deviceName,
        lastSeenAt: now,
      })

      return c.json({
        id: normalizedDeviceId,
        deviceType: input.deviceType,
        deviceName: input.deviceName,
        lastSeenAt: now.toISOString(),
      })
    },
  )

  app.post(
    "/v1/devices/pair/initiate",
    describeRoute({
      tags: ["Devices"],
      summary: "Initiate device pairing",
      description: "Creates a short-lived pairing code that another device can use to pair with the same user account.",
      responses: {
        200: jsonResponse("Pairing code generated.", initiatePairingResponseSchema),
        400: jsonResponse("The pairing initiation body was invalid.", invalidRequestSchema),
        401: jsonResponse("The caller must be signed in to initiate pairing.", unauthorizedSchema),
        429: jsonResponse("Too many pairing requests.", rateLimitedSchema),
      },
    }),
    authenticatedRoute(),
    jsonValidator(initiatePairingSchema),
    async (c) => {
      const user = c.get("user")
      if (!user?.id) {
        return c.json({ error: "unauthorized" }, 401)
      }

      const retryAfter = await enforceRateLimit(
        c.req.raw.headers,
        `pairing:initiate:${normalizeDenTypeId("user", user.id)}`,
        3,
        60_000,
      )
      if (retryAfter !== null) {
        c.header("Retry-After", String(retryAfter))
        return c.json({ error: "rate_limited", message: "Too many pairing requests. Try again later." }, 429)
      }

      const input = c.req.valid("json")
      const normalizedUserId = normalizeDenTypeId("user", user.id)
      const normalizedDeviceId = normalizeDenTypeId("device", input.deviceId)

      const device = await db
        .select({ id: DeviceTable.id })
        .from(DeviceTable)
        .where(
          and(
            eq(DeviceTable.id, normalizedDeviceId),
            eq(DeviceTable.userId, normalizedUserId),
          ),
        )
        .limit(1)

      if (!device[0]) {
        return c.json({ error: "unknown_device", message: "This device is not registered to the current user." }, 403)
      }

      const now = new Date()
      const expiresAt = new Date(now.getTime() + PAIRING_CODE_TTL_MS)

      await db
        .update(DevicePairingCodeTable)
        .set({ consumedAt: now })
        .where(
          and(
            eq(DevicePairingCodeTable.initiatedByUserId, normalizedUserId),
            isNull(DevicePairingCodeTable.consumedAt),
            gt(DevicePairingCodeTable.expiresAt, now),
          ),
        )

      const code = generatePairingCode()
      await db.insert(DevicePairingCodeTable).values({
        id: createDenTypeId("devicePairingCode"),
        code,
        initiatedByDeviceId: normalizedDeviceId,
        initiatedByUserId: normalizedUserId,
        expiresAt,
        consumedAt: null,
      })

      logger.info("pairing code initiated", {
        user_id: normalizedUserId,
        device_id: normalizedDeviceId,
      })

      return c.json({
        code,
        expiresAt: expiresAt.toISOString(),
      })
    },
  )

  app.post(
    "/v1/devices/pair/complete",
    describeRoute({
      tags: ["Devices"],
      summary: "Complete device pairing",
      description: "Completes pairing by consuming a pairing code. The completing device is linked to the same user account as the initiating device.",
      responses: {
        200: jsonResponse("Pairing completed successfully.", completePairingResponseSchema),
        400: jsonResponse("The pairing completion body was invalid.", invalidRequestSchema),
        401: jsonResponse("The caller must be signed in to complete pairing.", unauthorizedSchema),
        404: jsonResponse("The pairing code is invalid, expired, or already used.", invalidCodeSchema),
        429: jsonResponse("Too many pairing attempts.", rateLimitedSchema),
      },
    }),
    authenticatedRoute(),
    jsonValidator(completePairingSchema),
    async (c) => {
      const user = c.get("user")
      if (!user?.id) {
        return c.json({ error: "unauthorized" }, 401)
      }

      const retryAfter = await enforceRateLimit(
        c.req.raw.headers,
        `pairing:complete:${normalizeDenTypeId("user", user.id)}`,
        5,
        60_000,
      )
      if (retryAfter !== null) {
        c.header("Retry-After", String(retryAfter))
        return c.json({ error: "rate_limited", message: "Too many pairing attempts. Try again later." }, 429)
      }

      const input = c.req.valid("json")
      const normalizedUserId = normalizeDenTypeId("user", user.id)
      const normalizedDeviceId = normalizeDenTypeId("device", input.deviceId)
      const now = new Date()

      const result = await db.transaction(async (tx) => {
        const [codeRow] = await tx
          .select({
            id: DevicePairingCodeTable.id,
            initiatedByUserId: DevicePairingCodeTable.initiatedByUserId,
            initiatedByDeviceId: DevicePairingCodeTable.initiatedByDeviceId,
            expiresAt: DevicePairingCodeTable.expiresAt,
            consumedAt: DevicePairingCodeTable.consumedAt,
          })
          .from(DevicePairingCodeTable)
          .where(
            and(
              eq(DevicePairingCodeTable.code, input.code),
              isNull(DevicePairingCodeTable.consumedAt),
              gt(DevicePairingCodeTable.expiresAt, now),
            ),
          )
          .limit(1)

        if (!codeRow) {
          const [expiredRow] = await tx
            .select({ id: DevicePairingCodeTable.id })
            .from(DevicePairingCodeTable)
            .where(eq(DevicePairingCodeTable.code, input.code))
            .limit(1)

          if (expiredRow) {
            return { error: "expired_code" as const }
          }
          return { error: "invalid_code" as const }
        }

        if (codeRow.initiatedByUserId === normalizedUserId) {
          return { error: "same_user" as const }
        }

        const consumedAt = new Date()
        await tx
          .update(DevicePairingCodeTable)
          .set({
            consumedAt,
            completedByDeviceId: normalizedDeviceId,
            completedByUserId: normalizedUserId,
          })
          .where(
            and(
              eq(DevicePairingCodeTable.id, codeRow.id),
              isNull(DevicePairingCodeTable.consumedAt),
              gt(DevicePairingCodeTable.expiresAt, now),
            ),
          )

        const [claimed] = await tx
          .select({ id: DevicePairingCodeTable.id })
          .from(DevicePairingCodeTable)
          .where(
            and(
              eq(DevicePairingCodeTable.id, codeRow.id),
              eq(DevicePairingCodeTable.consumedAt, consumedAt),
            ),
          )
          .limit(1)

        if (!claimed) {
          return { error: "already_used" as const }
        }

        return {
          ok: true as const,
          pairedUserId: codeRow.initiatedByUserId,
          pairedDeviceId: codeRow.initiatedByDeviceId,
        }
      })

      if (result.error === "expired_code") {
        return c.json({ error: "expired_code", message: "This pairing code has expired." }, 404)
      }
      if (result.error === "invalid_code") {
        return c.json({ error: "invalid_code", message: "This pairing code is invalid." }, 404)
      }
      if (result.error === "already_used") {
        return c.json({ error: "already_used", message: "This pairing code has already been used." }, 404)
      }
      if (result.error === "same_user") {
        return c.json({ error: "invalid_code", message: "Cannot pair a device with itself." }, 404)
      }

      await db.insert(DeviceTable).values({
        id: normalizedDeviceId,
        userId: result.pairedUserId,
        deviceType: input.deviceType,
        deviceName: input.deviceName,
        lastSeenAt: now,
      }).onDuplicateKeyUpdate({
        set: {
          userId: result.pairedUserId,
          deviceName: input.deviceName,
          lastSeenAt: now,
        },
      })

      logger.info("pairing completed", {
        paired_user_id: result.pairedUserId,
        initiated_device_id: result.pairedDeviceId,
        completed_device_id: normalizedDeviceId,
      })

      return c.json({
        paired: true,
        pairedDeviceId: result.pairedDeviceId,
        pairedUserId: result.pairedUserId,
      })
    },
  )

  app.get(
    "/v1/devices",
    describeRoute({
      tags: ["Devices"],
      summary: "List paired devices",
      description: "Returns all devices registered to the current user.",
      responses: {
        200: jsonResponse("Devices listed successfully.", listDevicesResponseSchema),
        401: jsonResponse("The caller must be signed in to list devices.", unauthorizedSchema),
      },
    }),
    authenticatedRoute(),
    async (c) => {
      const user = c.get("user")
      if (!user?.id) {
        return c.json({ error: "unauthorized" }, 401)
      }

      const normalizedUserId = normalizeDenTypeId("user", user.id)
      const devices = await db
        .select({
          id: DeviceTable.id,
          deviceType: DeviceTable.deviceType,
          deviceName: DeviceTable.deviceName,
          lastSeenAt: DeviceTable.lastSeenAt,
        })
        .from(DeviceTable)
        .where(eq(DeviceTable.userId, normalizedUserId))
        .orderBy(DeviceTable.lastSeenAt)

      return c.json({
        devices: devices.map((d) => ({
          id: d.id,
          deviceType: d.deviceType as "desktop" | "mobile",
          deviceName: d.deviceName,
          lastSeenAt: d.lastSeenAt.toISOString(),
        })),
      })
    },
  )

  app.delete(
    "/v1/devices/:deviceId",
    describeRoute({
      tags: ["Devices"],
      summary: "Unpair a device",
      description: "Removes a device from the current user's account.",
      responses: {
        200: jsonResponse("Device unpaired successfully.", unpairDeviceResponseSchema),
        401: jsonResponse("The caller must be signed in to unpair a device.", unauthorizedSchema),
        404: jsonResponse("The device was not found.", notFoundSchema),
      },
    }),
    authenticatedRoute(),
    jsonValidator(unpairDeviceSchema),
    async (c) => {
      const user = c.get("user")
      if (!user?.id) {
        return c.json({ error: "unauthorized" }, 401)
      }

      const input = c.req.valid("json")
      const normalizedUserId = normalizeDenTypeId("user", user.id)
      const normalizedDeviceId = normalizeDenTypeId("device", input.deviceId)

      const result = await db
        .delete(DeviceTable)
        .where(
          and(
            eq(DeviceTable.id, normalizedDeviceId),
            eq(DeviceTable.userId, normalizedUserId),
          ),
        )

      if ((result as unknown as { rowsAffected: number })?.rowsAffected === 0) {
        return c.json({ error: "not_found", message: "Device not found." }, 404)
      }

      return c.json({ ok: true })
    },
  )
}
