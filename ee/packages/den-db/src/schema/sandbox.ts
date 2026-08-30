import { index, mysqlEnum, mysqlTable, timestamp, varchar, int } from "drizzle-orm/mysql-core"
import { denTypeIdColumn, timestamps } from "../columns"

export const SandboxAllocationStatus = ["allocating", "active", "stopped", "deallocated"] as const

export const SandboxAllocationTable = mysqlTable(
  "sandbox_allocation",
  {
    id: denTypeIdColumn("sandboxAllocation", "id").notNull().primaryKey(),
    org_id: denTypeIdColumn("org", "org_id").notNull(),
    user_id: denTypeIdColumn("user", "user_id").notNull(),
    worker_id: denTypeIdColumn("worker", "worker_id"),
    name: varchar("name", { length: 255 }).notNull(),
    status: mysqlEnum("status", SandboxAllocationStatus).notNull(),
    usage_minutes: int("usage_minutes").notNull().default(0),
    allocated_at: timestamp("allocated_at", { fsp: 3 }).notNull(),
    stopped_at: timestamp("stopped_at", { fsp: 3 }),
    ...timestamps,
  },
  (table) => [
    index("sandbox_allocation_org_id").on(table.org_id),
    index("sandbox_allocation_user_id").on(table.user_id),
    index("sandbox_allocation_status").on(table.status),
  ],
)

export const SandboxQuotaTable = mysqlTable(
  "sandbox_quota",
  {
    org_id: denTypeIdColumn("org", "org_id").notNull().primaryKey(),
    monthly_limit_minutes: int("monthly_limit_minutes").notNull().default(10000),
    used_minutes: int("used_minutes").notNull().default(0),
    period_start: timestamp("period_start", { fsp: 3 }).notNull(),
    ...timestamps,
  },
)