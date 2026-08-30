/**
 * Credits REST API.
 *
 * - GET    /v1/credits/balance        Get org credits balance + tier
 * - GET    /v1/credits/transactions   List credit transactions (paginated)
 * - POST   /v1/credits/purchase       Purchase/add credits
 * - POST   /v1/credits/grant          Grant credits (admin)
 * - POST   /v1/credits/consume        Consume credits
 * - POST   /v1/credits/refund         Refund credits
 * - PUT    /v1/credits/tier           Set org tier
 */

import type { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { z } from "zod"
import { orgMemberRoute, jsonValidator } from "../../middleware/index.js"
import { jsonResponse, invalidRequestSchema, forbiddenSchema } from "../../openapi.js"
import type { AuthContextVariables } from "../../session.js"
import type { OrganizationContextVariables } from "../../middleware/organization-context.js"
import {
  addCredits,
  deductCredits,
  refundCredits,
  getBalance,
  getTransactions,
  setTier,
  InsufficientCreditsError,
  type CreditsTier,
} from "../../credits/credits-service.js"

type CreditsRouteVariables = AuthContextVariables & Partial<OrganizationContextVariables>

const tierSchema = z.enum(["free", "pro", "enterprise"])

const balanceSchema = z.object({
  orgId: z.string(),
  tier: tierSchema,
  balance: z.number(),
  totalPurchased: z.number(),
  totalConsumed: z.number(),
  multiplier: z.number(),
})

const transactionSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  type: z.enum(["purchase", "consumption", "refund", "grant"]),
  amount: z.number(),
  balanceAfter: z.number(),
  description: z.string().nullable(),
  reference: z.string().nullable(),
  createdAt: z.string().datetime(),
})

const purchaseSchema = z.object({
  amount: z.number().int().positive(),
  reference: z.string().max(255).optional(),
})

const consumeSchema = z.object({
  amount: z.number().int().positive(),
  description: z.string().max(512).optional(),
  reference: z.string().max(255).optional(),
})

const setTierSchema = z.object({
  tier: tierSchema,
})

export function registerCreditsRoutes<T extends { Variables: CreditsRouteVariables }>(app: Hono<T>) {
  app.get(
    "/v1/credits/balance",
    describeRoute({
      tags: ["Credits"],
      summary: "Get credits balance",
      responses: {
        200: jsonResponse("Credits balance", balanceSchema),
      },
    }),
    orgMemberRoute(),
    async (c) => {
      const orgId = c.get("activeOrganizationId")
      const balance = await getBalance(orgId)
      return c.json(balance, 200)
    },
  )

  app.get(
    "/v1/credits/transactions",
    describeRoute({
      tags: ["Credits"],
      summary: "List credit transactions",
      responses: {
        200: jsonResponse("Credit transactions", z.object({
          transactions: z.array(transactionSchema),
        })),
      },
    }),
    orgMemberRoute(),
    async (c) => {
      const orgId = c.get("activeOrganizationId")
      const url = new URL(c.req.url)
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200)
      const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0
      const transactions = await getTransactions(orgId, limit, offset)
      return c.json({ transactions }, 200)
    },
  )

  app.post(
    "/v1/credits/purchase",
    describeRoute({
      tags: ["Credits"],
      summary: "Purchase credits",
      responses: {
        200: jsonResponse("Credits purchased", balanceSchema),
        400: jsonResponse("Invalid request", invalidRequestSchema),
      },
    }),
    orgMemberRoute(),
    jsonValidator(purchaseSchema),
    async (c) => {
      const orgId = c.get("activeOrganizationId")
      const body = c.req.valid("json" as never) as z.infer<typeof purchaseSchema>
      const balance = await addCredits({
        orgId,
        amount: body.amount,
        type: "purchase",
        reference: body.reference,
      })
      return c.json(balance, 200)
    },
  )

  app.post(
    "/v1/credits/grant",
    describeRoute({
      tags: ["Credits"],
      summary: "Grant credits (admin)",
      responses: {
        200: jsonResponse("Credits granted", balanceSchema),
        400: jsonResponse("Invalid request", invalidRequestSchema),
      },
    }),
    orgMemberRoute(),
    jsonValidator(purchaseSchema),
    async (c) => {
      const orgId = c.get("activeOrganizationId")
      const body = c.req.valid("json" as never) as z.infer<typeof purchaseSchema>
      const balance = await addCredits({
        orgId,
        amount: body.amount,
        type: "grant",
        reference: body.reference,
      })
      return c.json(balance, 200)
    },
  )

  app.post(
    "/v1/credits/consume",
    describeRoute({
      tags: ["Credits"],
      summary: "Consume credits",
      responses: {
        200: jsonResponse("Credits consumed", balanceSchema),
        400: jsonResponse("Invalid request", invalidRequestSchema),
        403: jsonResponse("Insufficient credits", forbiddenSchema),
      },
    }),
    orgMemberRoute(),
    jsonValidator(consumeSchema),
    async (c) => {
      const orgId = c.get("activeOrganizationId")
      const body = c.req.valid("json" as never) as z.infer<typeof consumeSchema>
      try {
        const balance = await deductCredits({
          orgId,
          amount: body.amount,
          description: body.description,
          reference: body.reference,
        })
        return c.json(balance, 200)
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          return c.json(
            { error: "insufficient_credits", message: error.message, balance: error.balance, requested: error.requested },
            403,
          )
        }
        throw error
      }
    },
  )

  app.post(
    "/v1/credits/refund",
    describeRoute({
      tags: ["Credits"],
      summary: "Refund credits",
      responses: {
        200: jsonResponse("Credits refunded", balanceSchema),
        400: jsonResponse("Invalid request", invalidRequestSchema),
      },
    }),
    orgMemberRoute(),
    jsonValidator(consumeSchema),
    async (c) => {
      const orgId = c.get("activeOrganizationId")
      const body = c.req.valid("json" as never) as z.infer<typeof consumeSchema>
      const balance = await refundCredits({
        orgId,
        amount: body.amount,
        description: body.description,
        reference: body.reference,
      })
      return c.json(balance, 200)
    },
  )

  app.put(
    "/v1/credits/tier",
    describeRoute({
      tags: ["Credits"],
      summary: "Set org credit tier",
      responses: {
        200: jsonResponse("Tier updated", balanceSchema),
        400: jsonResponse("Invalid request", invalidRequestSchema),
      },
    }),
    orgMemberRoute(),
    jsonValidator(setTierSchema),
    async (c) => {
      const orgId = c.get("activeOrganizationId")
      const body = c.req.valid("json" as never) as z.infer<typeof setTierSchema>
      const balance = await setTier(orgId, body.tier as CreditsTier)
      return c.json(balance, 200)
    },
  )
}