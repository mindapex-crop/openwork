/**
 * 沙箱自动分配服务：多沙箱 per user + 配额管控 + 用量计量。
 *
 * 复用现有 provisioner + cloud-lifecycle 进行实际 provisioning，
 * 本模块负责分配记录、配额检查、用量跟踪。
 */

import { and, desc, eq, sql } from "@openwork-ee/den-db/drizzle"
import { SandboxAllocationTable, SandboxQuotaTable } from "@openwork-ee/den-db/schema"
import { createDenTypeId, type DenTypeId } from "@openwork-ee/utils/typeid"
import { db } from "../db.js"

const DEFAULT_MONTHLY_LIMIT_MINUTES = 10_000
const DEFAULT_MAX_CONCURRENT_SANDBOXES = 3

export type SandboxAllocationStatus = "allocating" | "active" | "stopped" | "deallocated"

export interface SandboxAllocation {
  id: string
  orgId: string
  userId: string
  workerId: string | null
  name: string
  status: SandboxAllocationStatus
  usageMinutes: number
  allocatedAt: Date
  stoppedAt: Date | null
}

export interface SandboxQuotaStatus {
  orgId: string
  monthlyLimitMinutes: number
  usedMinutes: number
  remainingMinutes: number
  periodStart: Date
}

export interface AllocateSandboxInput {
  orgId: DenTypeId<"org">
  userId: DenTypeId<"user">
  name: string
}

export interface AllocateSandboxResult {
  allocation: SandboxAllocation
  provisioningStarted: boolean
}

export class SandboxQuotaExceededError extends Error {
  constructor(
    public readonly reason: "monthly_minutes_exceeded" | "max_concurrent_exceeded",
    message: string,
  ) {
    super(message)
    this.name = "SandboxQuotaExceededError"
  }
}

function toAllocation(row: typeof SandboxAllocationTable.$inferSelect): SandboxAllocation {
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    workerId: row.worker_id,
    name: row.name,
    status: row.status as SandboxAllocationStatus,
    usageMinutes: row.usage_minutes,
    allocatedAt: row.allocated_at,
    stoppedAt: row.stopped_at,
  }
}

export async function ensureQuotaExists(orgId: DenTypeId<"org">): Promise<void> {
  const existing = await db
    .select()
    .from(SandboxQuotaTable)
    .where(eq(SandboxQuotaTable.org_id, orgId))
    .limit(1)

  if (existing.length === 0) {
    await db.insert(SandboxQuotaTable).values({
      org_id: orgId,
      monthly_limit_minutes: DEFAULT_MONTHLY_LIMIT_MINUTES,
      used_minutes: 0,
      period_start: new Date(),
    })
  }
}

export async function getQuotaStatus(orgId: DenTypeId<"org">): Promise<SandboxQuotaStatus> {
  await ensureQuotaExists(orgId)
  const [quota] = await db
    .select()
    .from(SandboxQuotaTable)
    .where(eq(SandboxQuotaTable.org_id, orgId))
    .limit(1)

  return {
    orgId: quota.org_id,
    monthlyLimitMinutes: quota.monthly_limit_minutes,
    usedMinutes: quota.used_minutes,
    remainingMinutes: Math.max(0, quota.monthly_limit_minutes - quota.used_minutes),
    periodStart: quota.period_start,
  }
}

export async function checkQuota(orgId: DenTypeId<"org">): Promise<{ allowed: boolean; reason?: string }> {
  const quota = await getQuotaStatus(orgId)
  if (quota.remainingMinutes <= 0) {
    return { allowed: false, reason: "monthly_minutes_exceeded" }
  }

  const activeCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(SandboxAllocationTable)
    .where(
      and(
        eq(SandboxAllocationTable.org_id, orgId),
        sql`${SandboxAllocationTable.status} IN ('allocating', 'active')`,
      ),
    )

  const count = Number(activeCount[0]?.count ?? 0)
  if (count >= DEFAULT_MAX_CONCURRENT_SANDBOXES) {
    return { allowed: false, reason: "max_concurrent_exceeded" }
  }

  return { allowed: true }
}

export async function allocateSandbox(
  input: AllocateSandboxInput,
): Promise<AllocateSandboxResult> {
  const quotaCheck = await checkQuota(input.orgId)
  if (!quotaCheck.allowed) {
    throw new SandboxQuotaExceededError(
      quotaCheck.reason as "monthly_minutes_exceeded" | "max_concurrent_exceeded",
      `Sandbox quota exceeded: ${quotaCheck.reason}`,
    )
  }

  const allocationId = createDenTypeId("sandboxAllocation")
  const now = new Date()

  await db.insert(SandboxAllocationTable).values({
    id: allocationId,
    org_id: input.orgId,
    user_id: input.userId,
    worker_id: null,
    name: input.name,
    status: "allocating",
    usage_minutes: 0,
    allocated_at: now,
    stopped_at: null,
  })

  const [row] = await db
    .select()
    .from(SandboxAllocationTable)
    .where(eq(SandboxAllocationTable.id, allocationId))
    .limit(1)

  return {
    allocation: toAllocation(row),
    provisioningStarted: true,
  }
}

export async function listSandboxAllocations(
  orgId: DenTypeId<"org">,
  userId?: DenTypeId<"user">,
): Promise<SandboxAllocation[]> {
  const conditions = [eq(SandboxAllocationTable.org_id, orgId)]
  if (userId) {
    conditions.push(eq(SandboxAllocationTable.user_id, userId))
  }

  const rows = await db
    .select()
    .from(SandboxAllocationTable)
    .where(and(...conditions))
    .orderBy(desc(SandboxAllocationTable.allocated_at))

  return rows.map(toAllocation)
}

export async function deallocateSandbox(
  allocationId: DenTypeId<"sandboxAllocation">,
  orgId: DenTypeId<"org">,
): Promise<SandboxAllocation | null> {
  const [existing] = await db
    .select()
    .from(SandboxAllocationTable)
    .where(and(eq(SandboxAllocationTable.id, allocationId), eq(SandboxAllocationTable.org_id, orgId)))
    .limit(1)

  if (!existing) return null

  const now = new Date()
  await db
    .update(SandboxAllocationTable)
    .set({
      status: "deallocated",
      stopped_at: now,
      updated_at: now,
    })
    .where(eq(SandboxAllocationTable.id, allocationId))

  const [updated] = await db
    .select()
    .from(SandboxAllocationTable)
    .where(eq(SandboxAllocationTable.id, allocationId))
    .limit(1)

  return toAllocation(updated)
}

export async function recordUsage(
  allocationId: DenTypeId<"sandboxAllocation">,
  minutes: number,
): Promise<void> {
  const now = new Date()
  await db
    .update(SandboxAllocationTable)
    .set({
      usage_minutes: sql`${SandboxAllocationTable.usage_minutes} + ${minutes}`,
      updated_at: now,
    })
    .where(eq(SandboxAllocationTable.id, allocationId))

  const [allocation] = await db
    .select()
    .from(SandboxAllocationTable)
    .where(eq(SandboxAllocationTable.id, allocationId))
    .limit(1)

  if (allocation) {
    await db
      .update(SandboxQuotaTable)
      .set({
        used_minutes: sql`${SandboxQuotaTable.used_minutes} + ${minutes}`,
        updated_at: now,
      })
      .where(eq(SandboxQuotaTable.org_id, allocation.org_id))
  }
}

export async function markAllocationActive(
  allocationId: DenTypeId<"sandboxAllocation">,
  workerId: DenTypeId<"worker">,
): Promise<void> {
  const now = new Date()
  await db
    .update(SandboxAllocationTable)
    .set({
      status: "active",
      worker_id: workerId,
      updated_at: now,
    })
    .where(eq(SandboxAllocationTable.id, allocationId))
}

export async function resetMonthlyQuota(orgId: DenTypeId<"org">): Promise<void> {
  const now = new Date()
  await db
    .update(SandboxQuotaTable)
    .set({
      used_minutes: 0,
      period_start: now,
      updated_at: now,
    })
    .where(eq(SandboxQuotaTable.org_id, orgId))
}

export {
  DEFAULT_MONTHLY_LIMIT_MINUTES,
  DEFAULT_MAX_CONCURRENT_SANDBOXES,
}