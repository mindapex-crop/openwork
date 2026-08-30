import { index, mysqlEnum, mysqlTable, timestamp, varchar, int, decimal } from "drizzle-orm/mysql-core"
import { denTypeIdColumn, timestamps } from "../columns"

export const CreditTier = ["free", "pro", "enterprise"] as const
export const CreditTransactionType = ["purchase", "consumption", "refund", "grant"] as const

export const CreditsBalanceTable = mysqlTable(
  "credits_balance",
  {
    org_id: denTypeIdColumn("org", "org_id").notNull().primaryKey(),
    tier: mysqlEnum("tier", CreditTier).notNull().default("free"),
    balance: int("balance").notNull().default(0),
    total_purchased: int("total_purchased").notNull().default(0),
    total_consumed: int("total_consumed").notNull().default(0),
    ...timestamps,
  },
)

export const CreditsTransactionTable = mysqlTable(
  "credits_transaction",
  {
    id: denTypeIdColumn("creditsTransaction", "id").notNull().primaryKey(),
    org_id: denTypeIdColumn("org", "org_id").notNull(),
    type: mysqlEnum("type", CreditTransactionType).notNull(),
    amount: int("amount").notNull(),
    balance_after: int("balance_after").notNull(),
    description: varchar("description", { length: 512 }),
    reference: varchar("reference", { length: 255 }),
    ...timestamps,
  },
  (table) => [
    index("credits_transaction_org_id").on(table.org_id),
    index("credits_transaction_type").on(table.type),
  ],
)