/**
 * Credits points service: balance + transactions + tier management.
 *
 * Every mutation records an immutable transaction row with balance_after,
 * so the ledger is reconstructable from the transaction log alone.
 */

import { and, desc, eq, sql } from "@openwork-ee/den-db/drizzle"
import {
  CreditsBalanceTable,
  CreditsTransactionTable,
  type CreditTier,
  type CreditTransactionType,
} from "@openwork-ee/den-db/schema"
import { createDenTypeId, type DenTypeId } from "@openwork-ee/utils/typeid"
import { db } from "../db.js"

const TIER_MULTIPLIERS: Record<string, number> = {
  free: 1.0,
  pro: 0.8,
  enterprise: 0.6,
}

export type CreditsTier = (typeof CreditTier)[number]
export type CreditsTransactionType = (typeof CreditTransactionType)[number]

export interface CreditsBalance {
  orgId: string
  tier: CreditsTier
  balance: number
  totalPurchased: number
  totalConsumed: number
  multiplier: number
}

export interface CreditsTransaction {
  id: string
  orgId: string
  type: CreditsTransactionType
  amount: number
  balanceAfter: number
  description: string | null
  reference: string | null
  createdAt: Date
}

export interface AddCreditsInput {
  orgId: DenTypeId<"org">
  amount: number
  type: "purchase" | "grant"
  description?: string
  reference?: string
}

export interface DeductCreditsInput {
  orgId: DenTypeId<"org">
  amount: number
  description?: string
  reference?: string
}

export class InsufficientCreditsError extends Error {
  constructor(
    public readonly balance: number,
    public readonly requested: number,
  ) {
    super(`Insufficient credits: have ${balance}, need ${requested}`)
    this.name = "InsufficientCreditsError"
  }
}

export function tierMultiplier(tier: string): number {
  return TIER_MULTIPLIERS[tier] ?? 1.0
}

function toBalance(row: typeof CreditsBalanceTable.$inferSelect): CreditsBalance {
  return {
    orgId: row.org_id,
    tier: row.tier as CreditsTier,
    balance: row.balance,
    totalPurchased: row.total_purchased,
    totalConsumed: row.total_consumed,
    multiplier: tierMultiplier(row.tier),
  }
}

function toTransaction(row: typeof CreditsTransactionTable.$inferSelect): CreditsTransaction {
  return {
    id: row.id,
    orgId: row.org_id,
    type: row.type as CreditsTransactionType,
    amount: row.amount,
    balanceAfter: row.balance_after,
    description: row.description,
    reference: row.reference,
    createdAt: row.created_at,
  }
}

export async function ensureBalanceExists(orgId: DenTypeId<"org">): Promise<void> {
  const existing = await db
    .select()
    .from(CreditsBalanceTable)
    .where(eq(CreditsBalanceTable.org_id, orgId))
    .limit(1)

  if (existing.length === 0) {
    await db.insert(CreditsBalanceTable).values({
      org_id: orgId,
      tier: "free",
      balance: 0,
      total_purchased: 0,
      total_consumed: 0,
    })
  }
}

export async function getBalance(orgId: DenTypeId<"org">): Promise<CreditsBalance> {
  await ensureBalanceExists(orgId)
  const [row] = await db
    .select()
    .from(CreditsBalanceTable)
    .where(eq(CreditsBalanceTable.org_id, orgId))
    .limit(1)
  return toBalance(row)
}

export async function getTier(orgId: DenTypeId<"org">): Promise<CreditsTier> {
  const balance = await getBalance(orgId)
  return balance.tier
}

export async function setTier(
  orgId: DenTypeId<"org">,
  tier: CreditsTier,
): Promise<CreditsBalance> {
  await ensureBalanceExists(orgId)
  const now = new Date()
  await db
    .update(CreditsBalanceTable)
    .set({ tier, updated_at: now })
    .where(eq(CreditsBalanceTable.org_id, orgId))
  return getBalance(orgId)
}

export async function addCredits(input: AddCreditsInput): Promise<CreditsBalance> {
  if (input.amount <= 0) {
    throw new Error("Amount must be positive")
  }
  await ensureBalanceExists(input.orgId)

  const [current] = await db
    .select()
    .from(CreditsBalanceTable)
    .where(eq(CreditsBalanceTable.org_id, input.orgId))
    .limit(1)

  const newBalance = current.balance + input.amount
  const newTotalPurchased = current.total_purchased + input.amount
  const now = new Date()
  const txId = createDenTypeId("creditsTransaction")

  await db.transaction(async (tx) => {
    await tx
      .update(CreditsBalanceTable)
      .set({
        balance: newBalance,
        total_purchased: newTotalPurchased,
        updated_at: now,
      })
      .where(eq(CreditsBalanceTable.org_id, input.orgId))

    await tx.insert(CreditsTransactionTable).values({
      id: txId,
      org_id: input.orgId,
      type: input.type,
      amount: input.amount,
      balance_after: newBalance,
      description: input.description ?? null,
      reference: input.reference ?? null,
    })
  })

  return getBalance(input.orgId)
}

export async function deductCredits(
  input: DeductCreditsInput,
): Promise<CreditsBalance> {
  if (input.amount <= 0) {
    throw new Error("Amount must be positive")
  }
  await ensureBalanceExists(input.orgId)

  const [current] = await db
    .select()
    .from(CreditsBalanceTable)
    .where(eq(CreditsBalanceTable.org_id, input.orgId))
    .limit(1)

  const multiplier = tierMultiplier(current.tier)
  const effectiveAmount = Math.ceil(input.amount * multiplier)

  if (current.balance < effectiveAmount) {
    throw new InsufficientCreditsError(current.balance, effectiveAmount)
  }

  const newBalance = current.balance - effectiveAmount
  const newTotalConsumed = current.total_consumed + effectiveAmount
  const now = new Date()
  const txId = createDenTypeId("creditsTransaction")

  await db.transaction(async (tx) => {
    await tx
      .update(CreditsBalanceTable)
      .set({
        balance: newBalance,
        total_consumed: newTotalConsumed,
        updated_at: now,
      })
      .where(eq(CreditsBalanceTable.org_id, input.orgId))

    await tx.insert(CreditsTransactionTable).values({
      id: txId,
      org_id: input.orgId,
      type: "consumption",
      amount: -effectiveAmount,
      balance_after: newBalance,
      description: input.description ?? null,
      reference: input.reference ?? null,
    })
  })

  return getBalance(input.orgId)
}

export async function refundCredits(
  input: DeductCreditsInput,
): Promise<CreditsBalance> {
  if (input.amount <= 0) {
    throw new Error("Amount must be positive")
  }
  await ensureBalanceExists(input.orgId)

  const [current] = await db
    .select()
    .from(CreditsBalanceTable)
    .where(eq(CreditsBalanceTable.org_id, input.orgId))
    .limit(1)

  const newBalance = current.balance + input.amount
  const now = new Date()
  const txId = createDenTypeId("creditsTransaction")

  await db.transaction(async (tx) => {
    await tx
      .update(CreditsBalanceTable)
      .set({
        balance: newBalance,
        updated_at: now,
      })
      .where(eq(CreditsBalanceTable.org_id, input.orgId))

    await tx.insert(CreditsTransactionTable).values({
      id: txId,
      org_id: input.orgId,
      type: "refund",
      amount: input.amount,
      balance_after: newBalance,
      description: input.description ?? null,
      reference: input.reference ?? null,
    })
  })

  return getBalance(input.orgId)
}

export async function getTransactions(
  orgId: DenTypeId<"org">,
  limit = 50,
  offset = 0,
): Promise<CreditsTransaction[]> {
  const rows = await db
    .select()
    .from(CreditsTransactionTable)
    .where(eq(CreditsTransactionTable.org_id, orgId))
    .orderBy(desc(CreditsTransactionTable.created_at))
    .limit(limit)
    .offset(offset)

  return rows.map(toTransaction)
}

export { TIER_MULTIPLIERS }
