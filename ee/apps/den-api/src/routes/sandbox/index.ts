/**
 * 沙箱自动分配 REST API。
 *
 * - POST   /v1/sandboxes/allocate       分配新沙箱（配额检查 + 创建分配记录）
 * - GET    /v1/sandboxes                 列出当前组织的沙箱分配
 * - GET    /v1/sandboxes/:id             获取单个沙箱分配详情
 * - DELETE /v1/sandboxes/:id             释放沙箱
 * - GET    /v1/sandboxes/quota           获取配额使用情况
 * - POST   /v1/sandboxes/:id/usage       上报用量（内部调用）
 */

import type { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { z } from "zod"
import { orgMemberRoute, jsonValidator, paramValidator } from "../../middleware/index.js"
import { jsonResponse, invalidRequestSchema, notFoundSchema, forbiddenSchema } from "../../openapi.js"
import type { AuthContextVariables } from "../../session.js"
import type { OrganizationContextVariables } from "../../middleware/organization-context.js"
import { createDenTypeId, type DenTypeId } from "@openwork-ee/utils/typeid"
import {
  allocateSandbox,
  listSandboxAllocations,
  deallocateSandbox,
  getQuotaStatus,
  recordUsage,
  SandboxQuotaExceededError,
} from "../../sandbox/sandbox-service.js"

type SandboxRouteVariables = AuthContextVariables & Partial<OrganizationContextVariables>

const allocateSchema = z.object({
  name: z.string().min(1).max(255),
})

const usageSchema = z.object({
  minutes: z.number().int().positive(),
})

const sandboxAllocationSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  userId: z.string(),
  workerId: z.string().nullable(),
  name: z.string(),
  status: z.string(),
  usageMinutes: z.number(),
  allocatedAt: z.string().datetime(),
  stoppedAt: z.string().datetime().nullable(),
})

const quotaSchema = z.object({
  orgId: z.string(),
  monthlyLimitMinutes: z.number(),
  usedMinutes: z.number(),
  remainingMinutes: z.number(),
  periodStart: z.string().datetime(),
})

export function registerSandboxRoutes<T extends { Variables: SandboxRouteVariables }>(app: Hono<T>) {
  app.post(
    "/v1/sandboxes/allocate",
    describeRoute({
      tags: ["Sandboxes"],
      summary: "Allocate a new sandbox",
      responses: {
        200: jsonResponse("Sandbox allocated", sandboxAllocationSchema),
        400: jsonResponse("Invalid request", invalidRequestSchema),
        403: jsonResponse("Quota exceeded", forbiddenSchema),
      },
    }),
    orgMemberRoute(),
    jsonValidator(allocateSchema),
    async (c) => {
      const orgId = c.get("activeOrganizationId")
      const user = c.get("user")
      const body = c.req.valid("json" as never) as z.infer<typeof allocateSchema>

      try {
        const result = await allocateSandbox({
          orgId,
          userId: user.id,
          name: body.name,
        })
        return c.json(result.allocation, 200)
      } catch (error) {
        if (error instanceof SandboxQuotaExceededError) {
          return c.json(
            { error: error.reason, message: error.message },
            403,
          )
        }
        throw error
      }
    },
  )

  app.get(
    "/v1/sandboxes",
    describeRoute({
      tags: ["Sandboxes"],
      summary: "List sandbox allocations",
      responses: {
        200: jsonResponse("Sandbox allocations", z.object({
          allocations: z.array(sandboxAllocationSchema),
        })),
      },
    }),
    orgMemberRoute(),
    async (c) => {
      const orgId = c.get("activeOrganizationId")
      const allocations = await listSandboxAllocations(orgId)
      return c.json({ allocations }, 200)
    },
  )

  app.get(
    "/v1/sandboxes/quota",
    describeRoute({
      tags: ["Sandboxes"],
      summary: "Get sandbox quota status",
      responses: {
        200: jsonResponse("Quota status", quotaSchema),
      },
    }),
    orgMemberRoute(),
    async (c) => {
      const orgId = c.get("activeOrganizationId")
      const quota = await getQuotaStatus(orgId)
      return c.json(quota, 200)
    },
  )

  app.delete(
    "/v1/sandboxes/:id",
    describeRoute({
      tags: ["Sandboxes"],
      summary: "Deallocate a sandbox",
      responses: {
        200: jsonResponse("Sandbox deallocated", sandboxAllocationSchema),
        404: jsonResponse("Not found", notFoundSchema),
      },
    }),
    orgMemberRoute(),
    paramValidator(z.object({ id: z.string() })),
    async (c) => {
      const orgId = c.get("activeOrganizationId")
      const { id } = c.req.valid("param" as never) as { id: string }

      const result = await deallocateSandbox(id as DenTypeId<"sandboxAllocation">, orgId)
      if (!result) {
        return c.json({ error: "not_found", message: "Sandbox allocation not found." }, 404)
      }
      return c.json(result, 200)
    },
  )

  app.post(
    "/v1/sandboxes/:id/usage",
    describeRoute({
      tags: ["Sandboxes"],
      summary: "Record sandbox usage (internal)",
      responses: {
        200: jsonResponse("Usage recorded", z.object({ ok: z.boolean() })),
        404: jsonResponse("Not found", notFoundSchema),
      },
    }),
    orgMemberRoute(),
    paramValidator(z.object({ id: z.string() })),
    jsonValidator(usageSchema),
    async (c) => {
      const { id } = c.req.valid("param" as never) as { id: string }
      const body = c.req.valid("json" as never) as z.infer<typeof usageSchema>

      await recordUsage(id as DenTypeId<"sandboxAllocation">, body.minutes)
      return c.json({ ok: true }, 200)
    },
  )
}