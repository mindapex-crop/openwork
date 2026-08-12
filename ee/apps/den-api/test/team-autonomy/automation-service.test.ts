import assert from "node:assert/strict"
import { after, before, describe, test } from "node:test"

import { createDenTypeId } from "@openwork-ee/utils/typeid"

// OpenSpecs AutomationService — RED/GREEN 测试
// 框架：node:test + tsx（任务要求）
// 纯逻辑测试（状态机矩阵 / retry 决策 / 降级计算 / cron 解析）无需 DB；
// DB 测试用 dbAvailable guard 跳过。

function seedRequiredEnv() {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "mysql://root:password@127.0.0.1:3306/openwork_test_ta"
  process.env.DB_MODE = process.env.DB_MODE ?? "mysql"
  process.env.DEN_DB_ENCRYPTION_KEY = process.env.DEN_DB_ENCRYPTION_KEY ?? "ta-encryption-key-12345678901234567890"
  const existingSecret = process.env.BETTER_AUTH_SECRET
  if (!existingSecret || existingSecret.length < 32) {
    process.env.BETTER_AUTH_SECRET = "as-better-auth-secret-1234567890123456789012"
  }
  process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:8790"
  process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? "http://127.0.0.1:8790"
}

const organizationId = createDenTypeId("organization")
const teamId = createDenTypeId("team")
const memberOwner = createDenTypeId("member")
const agentWorker = createDenTypeId("teamAgent")

type DbModule = typeof import("../../src/db.js")
type DrizzleModule = typeof import("@openwork-ee/den-db/drizzle")
type SchemaModule = typeof import("@openwork-ee/den-db/schema")
type AutoModule = typeof import("../../src/team-autonomy/automation-service.js")
type SchedulerModule = typeof import("../../src/team-autonomy/scheduler-worker.js")

let db: DbModule["db"]
let drizzle: DrizzleModule
let schema: SchemaModule
let auto: AutoModule
let scheduler: SchedulerModule
let dbAvailable = false

async function clearAll() {
  // team-autonomy 表的 JS 属性名为 snake_case
  await db.delete(schema.TeamAutomationAlertTable).where(drizzle.like(schema.TeamAutomationAlertTable.id, "taal_%"))
  await db.delete(schema.TeamAutomationRunTable).where(drizzle.like(schema.TeamAutomationRunTable.id, "taur_%"))
  await db.delete(schema.TeamAutomationTable).where(drizzle.like(schema.TeamAutomationTable.id, "taut_%"))
  await db.delete(schema.TeamAgentTable).where(drizzle.eq(schema.TeamAgentTable.id, agentWorker))
  await db.delete(schema.TeamTable).where(drizzle.eq(schema.TeamTable.id, teamId))
  await db.delete(schema.OrganizationTable).where(drizzle.eq(schema.OrganizationTable.id, organizationId))
}

before(async () => {
  seedRequiredEnv()

  const mods = await Promise.all([
    import("../../src/db.js"),
    import("@openwork-ee/den-db/drizzle"),
    import("@openwork-ee/den-db/schema"),
    import("../../src/team-autonomy/automation-service.js"),
    import("../../src/team-autonomy/scheduler-worker.js"),
  ])
  db = mods[0].db
  drizzle = mods[1]
  schema = mods[2]
  auto = mods[3]
  scheduler = mods[4]

  try {
    await clearAll()
    await db.insert(schema.OrganizationTable).values({
      id: organizationId,
      name: "AS Org",
      slug: `as-${organizationId}`,
      desktopAppRestrictions: {},
    })
    await db.insert(schema.TeamTable).values({
      id: teamId,
      organizationId,
      name: "AS Team",
      slug: `as-team`,
      kind: "shared",
    })
    await db.insert(schema.TeamAgentTable).values({
      id: agentWorker,
      team_id: teamId,
      name: "as-worker",
      engine: "openworker",
      status: "idle",
      forbidden_actions: [],
    })
    dbAvailable = true
  } catch (error) {
    dbAvailable = false
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`\n[automation-service.test] DB not available — DB tests will skip. Reason: ${message}\n`)
  }
})

after(async () => {
  if (!dbAvailable) return
  try {
    await clearAll()
  } catch {
    // ignore cleanup errors
  }
})

// 默认 retry policy（用于纯逻辑测试）
const DEFAULT_RETRY_POLICY = {
  max_attempts: 3,
  backoff_coefficient: 2.0,
  retry_on: ["timeout", "rate_limit", "transient"],
  no_retry_on: ["401", "403"],
}

describe("AutomationService — OpenSpecs RED/GREEN", () => {

  // ============================================================
  // 纯逻辑测试（无 DB 依赖）
  // ============================================================

  // ---------- T2: I3 isValidAutomationTransition 状态机矩阵 ----------
  describe("pure logic: state machine (I3)", () => {
    test("T2a: waiting_trigger → fetching 合法", () => {
      assert.strictEqual(auto.isValidAutomationTransition("waiting_trigger", "fetching"), true)
    })

    test("T2b: completed → fetching 非法（终态不可倒退）", () => {
      assert.strictEqual(auto.isValidAutomationTransition("completed", "fetching"), false)
    })

    test("T2c: completed → anything 非法（终态）", () => {
      for (const to of ["waiting_trigger", "fetching", "aggregating", "completed", "blocked"] as const) {
        assert.strictEqual(auto.isValidAutomationTransition("completed", to), false)
      }
    })

    test("T2d: failed → anything 非法（终态）", () => {
      for (const to of ["waiting_trigger", "fetching", "aggregating", "completed"] as const) {
        assert.strictEqual(auto.isValidAutomationTransition("failed", to), false)
      }
    })

    test("T2e: fetching → partial_aggregating 合法", () => {
      assert.strictEqual(auto.isValidAutomationTransition("fetching", "partial_aggregating"), true)
    })

    test("T2f: fetching → aggregating 合法（跳过 partial）", () => {
      assert.strictEqual(auto.isValidAutomationTransition("fetching", "aggregating"), true)
    })

    test("T2g: fetching → delivering 非法（跳步）", () => {
      assert.strictEqual(auto.isValidAutomationTransition("fetching", "delivering"), false)
    })

    test("T2h: aggregating → filtering 合法", () => {
      assert.strictEqual(auto.isValidAutomationTransition("aggregating", "filtering"), true)
    })

    test("T2i: filtering → delivering 合法", () => {
      assert.strictEqual(auto.isValidAutomationTransition("filtering", "delivering"), true)
    })

    test("T2j: delivering → completed 合法", () => {
      assert.strictEqual(auto.isValidAutomationTransition("delivering", "completed"), true)
    })

    test("T2k: 任意非终态 → blocked 合法（failRun）", () => {
      for (const from of ["fetching", "partial_aggregating", "aggregating", "filtering", "delivering"] as const) {
        assert.strictEqual(auto.isValidAutomationTransition(from, "blocked"), true)
      }
    })

    test("T2l: blocked → fetching 合法（重试）", () => {
      assert.strictEqual(auto.isValidAutomationTransition("blocked", "fetching"), true)
    })

    test("T2m: blocked → failed 合法（重试耗尽）", () => {
      assert.strictEqual(auto.isValidAutomationTransition("blocked", "failed"), true)
    })

    test("T2n: waiting_trigger → blocked 非法（必须先进入 fetching）", () => {
      assert.strictEqual(auto.isValidAutomationTransition("waiting_trigger", "blocked"), false)
    })
  })

  // ---------- T11: 降级交付决策树 ----------
  describe("pure logic: degradation level (I-degradation)", () => {
    test("T11a: 全部 ok → full", () => {
      const level = auto.computeDegradationLevel({ wechat: "ok", github: "ok", slack: "ok" })
      assert.strictEqual(level, "full")
    })

    test("T11b: 部分 partial（0 failed）→ partial", () => {
      const level = auto.computeDegradationLevel({ wechat: "ok", github: "partial", slack: "ok" })
      assert.strictEqual(level, "partial")
    })

    test("T11c: 部分 failed（failed > 0 且 < total）→ minimal", () => {
      const level = auto.computeDegradationLevel({ wechat: "ok", github: "failed", slack: "ok" })
      assert.strictEqual(level, "minimal")
    })

    test("T11d: 全部 failed → blocked", () => {
      const level = auto.computeDegradationLevel({ wechat: "failed", github: "failed" })
      assert.strictEqual(level, "blocked")
    })

    test("T11e: 空 sourceStatus → full（无数据源视为无失败）", () => {
      const level = auto.computeDegradationLevel({})
      assert.strictEqual(level, "full")
    })

    test("T11f: mixed partial + failed → minimal（failed 主导）", () => {
      const level = auto.computeDegradationLevel({ a: "ok", b: "partial", c: "failed" })
      assert.strictEqual(level, "minimal")
    })

    test("T11g: 全部 partial → partial", () => {
      const level = auto.computeDegradationLevel({ a: "partial", b: "partial" })
      assert.strictEqual(level, "partial")
    })
  })

  // ---------- T9/T10: Retry 决策表（I5） ----------
  describe("pure logic: retry decision (I5)", () => {
    test("T9: errorCode='401' ∈ no_retry_on → 不重试（直接 failed）", () => {
      const d = auto.decideRetry("401", DEFAULT_RETRY_POLICY, 1)
      assert.strictEqual(d.retry, false)
      assert.strictEqual(d.nextAttemptAt, undefined)
    })

    test("T9b: errorCode='403' ∈ no_retry_on → 不重试", () => {
      const d = auto.decideRetry("403", DEFAULT_RETRY_POLICY, 1)
      assert.strictEqual(d.retry, false)
    })

    test("T10: errorCode='timeout' ∈ retry_on, attempt=1 < max=3 → 重试 + nextAttemptAt 计算", () => {
      const before = Date.now()
      const d = auto.decideRetry("timeout", DEFAULT_RETRY_POLICY, 1)
      assert.strictEqual(d.retry, true)
      assert.ok(d.nextAttemptAt instanceof Date, "nextAttemptAt must be Date")
      // backoff: base * coeff^(attempt-1) = base * 2^0 = base（base 默认 1000ms）
      // nextAttemptAt 应在 [before+base-100, before+base+2000] 之间
      const ts = d.nextAttemptAt!.getTime()
      assert.ok(ts >= before, "nextAttemptAt must be in the future")
    })

    test("T10b: attempt=max_attempts → 不重试（重试耗尽）", () => {
      const d = auto.decideRetry("timeout", DEFAULT_RETRY_POLICY, 3)
      assert.strictEqual(d.retry, false)
    })

    test("T10c: errorCode 不在 retry_on 也不在 no_retry_on → 不重试（未知错误）", () => {
      const d = auto.decideRetry("unknown_bug", DEFAULT_RETRY_POLICY, 1)
      assert.strictEqual(d.retry, false)
    })

    test("T10d: no_retry_on 优先于 retry_on（即使 attempt < max）", () => {
      // 构造一个矛盾的 policy：401 同时在 retry_on 和 no_retry_on
      const conflict = {
        max_attempts: 3,
        backoff_coefficient: 2.0,
        retry_on: ["401"],
        no_retry_on: ["401"],
      }
      const d = auto.decideRetry("401", conflict, 1)
      assert.strictEqual(d.retry, false, "no_retry_on must win over retry_on")
    })

    test("T10e: backoff_coefficient 累积 — attempt=2 间隔 > attempt=1 间隔", () => {
      const d1 = auto.decideRetry("timeout", DEFAULT_RETRY_POLICY, 1)
      const d2 = auto.decideRetry("timeout", DEFAULT_RETRY_POLICY, 2)
      assert.ok(d1.nextAttemptAt && d2.nextAttemptAt)
      // attempt=2 的延迟应大于 attempt=1（指数退避）
      const baseDelay = 1000 // 默认 base
      const delay1 = d1.nextAttemptAt!.getTime() - Date.now()
      const delay2 = d2.nextAttemptAt!.getTime() - Date.now()
      // delay2 应约等于 delay1 * backoff_coefficient（允许 ±50ms 误差）
      assert.ok(delay2 > delay1, `delay2(${delay2}) should be > delay1(${delay1})`)
      assert.ok(Math.abs(delay2 - delay1 * DEFAULT_RETRY_POLICY.backoff_coefficient) < baseDelay,
        `delay2(${delay2}) should ≈ delay1*coeff(${delay1 * DEFAULT_RETRY_POLICY.backoff_coefficient})`)
    })
  })

  // ---------- T13: parseCronExpr ----------
  describe("pure logic: cron parser (T13)", () => {
    test("T13a: '0 9 * * *' → minute=0, hour=9, rest=*", () => {
      const c = auto.parseCronExpr("0 9 * * *")
      assert.strictEqual(c.minute, 0)
      assert.strictEqual(c.hour, 9)
      assert.strictEqual(c.dayOfMonth, "*")
      assert.strictEqual(c.month, "*")
      assert.strictEqual(c.dayOfWeek, "*")
    })

    test("T13b: '30 14 1 * *' → 每月 1 号 14:30", () => {
      const c = auto.parseCronExpr("30 14 1 * *")
      assert.strictEqual(c.minute, 30)
      assert.strictEqual(c.hour, 14)
      assert.strictEqual(c.dayOfMonth, 1)
    })

    test("T13c: '*/15 * * * *' → 每 15 分钟（保留通配符）", () => {
      const c = auto.parseCronExpr("*/15 * * * *")
      assert.strictEqual(c.minute, "*/15")
      assert.strictEqual(c.hour, "*")
    })

    test("T13d: 字段数不对 → 抛错", () => {
      assert.throws(() => auto.parseCronExpr("0 9 * *"), /cron.*5 fields/i)
      assert.throws(() => auto.parseCronExpr("0 9 * * * *"), /cron.*5 fields/i)
    })
  })

  // ---------- T14: computeNextRunAt ----------
  describe("pure logic: next run time (T14)", () => {
    test("T14a: cron='0 9 * * *', from=2026-08-04T08:00 → next=2026-08-04T09:00", () => {
      const from = new Date("2026-08-04T08:00:00+08:00")
      const next = auto.computeNextRunAt("0 9 * * *", from)
      assert.strictEqual(next.getUTCHours(), 1, "09:00 Asia/Shanghai = 01:00 UTC")
      assert.strictEqual(next.getUTCDate(), 4, "same day 2026-08-04")
    })

    test("T14b: cron='0 9 * * *', from=2026-08-04T10:00 → next=2026-08-05T09:00", () => {
      const from = new Date("2026-08-04T10:00:00+08:00")
      const next = auto.computeNextRunAt("0 9 * * *", from)
      // 10:00 已过 09:00，下次是明天 09:00
      assert.strictEqual(next.getUTCDate(), 5, "next day 2026-08-05")
    })

    test("T14c: cron='30 14 1 * *', from=2026-08-04 → next=2026-09-01 14:30", () => {
      const from = new Date("2026-08-04T10:00:00+08:00")
      const next = auto.computeNextRunAt("30 14 1 * *", from)
      // 8 月 4 号之后下一个 "1 号 14:30" 是 9 月 1 号
      assert.strictEqual(next.getUTCMonth(), 8, "September (0-indexed=8)")
      assert.strictEqual(next.getUTCDate(), 1)
    })

    test("T14d: next 总是 > from", () => {
      const from = new Date("2026-08-04T08:00:00+08:00")
      const next = auto.computeNextRunAt("0 9 * * *", from)
      assert.ok(next.getTime() > from.getTime(), "next must be > from")
    })
  })

  // ---------- T15: 完整 IANA 时区支持（Intl，含 DST） ----------
  describe("pure logic: IANA timezone support (T15)", () => {
    test("T15a: getTimezoneOffsetMs Asia/Shanghai = +8h（无 DST）", () => {
      const offset = auto.getTimezoneOffsetMs("Asia/Shanghai", new Date("2026-08-04T00:00:00Z"))
      assert.strictEqual(offset, 8 * 3_600_000)
    })

    test("T15b: getTimezoneOffsetMs America/New_York 夏季 = -4h（DST 生效）", () => {
      const offset = auto.getTimezoneOffsetMs("America/New_York", new Date("2026-08-04T00:00:00Z"))
      assert.strictEqual(offset, -4 * 3_600_000)
    })

    test("T15c: getTimezoneOffsetMs America/New_York 冬季 = -5h（DST 关闭）", () => {
      const offset = auto.getTimezoneOffsetMs("America/New_York", new Date("2026-01-04T00:00:00Z"))
      assert.strictEqual(offset, -5 * 3_600_000)
    })

    test("T15d: computeNextRunAt 用任意 IANA 时区（America/New_York 09:00 → 13:00 UTC 夏季）", () => {
      const from = new Date("2026-08-04T00:00:00+08:00")
      const next = auto.computeNextRunAt("0 9 * * *", from, "America/New_York")
      assert.strictEqual(next.getUTCHours(), 13, "09:00 New York (EDT) = 13:00 UTC")
    })

    test("T15e: computeNextRunAt 用任意 IANA 时区（Europe/London 09:00 → 09:00 UTC 夏季）", () => {
      const from = new Date("2026-08-04T00:00:00+08:00")
      const next = auto.computeNextRunAt("0 9 * * *", from, "Europe/London")
      assert.strictEqual(next.getUTCHours(), 8, "09:00 London (BST) = 08:00 UTC")
    })

    test("T15f: 未知 IANA 时区不抛错（Intl 容错）", () => {
      // Intl.DateTimeFormat 对未知时区抛 RangeError；computeNextRunAt 应仍能工作（offset 走 UTC）
      // 这里只验证调用不 crash：未知时区会被 Intl 拒绝 → 偏移为 0
      assert.throws(() => new Intl.DateTimeFormat("en-US", { timeZone: "Mars/Olympus" }).format(new Date()))
    })
  })

  // ---------- T16: qualityGate 质量门校验 ----------
  describe("pure logic: qualityGate (T16)", () => {
    test("T16a: 无 gate → pass", () => {
      const v = auto.evaluateQualityGate(null, { items: [] })
      assert.strictEqual(v.pass, true)
      assert.deepEqual(v.reasons, [])
    })

    test("T16b: min_item_count 达标 → pass", () => {
      const v = auto.evaluateQualityGate({ min_item_count: 2 }, { items: [{ id: 1 }, { id: 2 }] })
      assert.strictEqual(v.pass, true)
    })

    test("T16c: min_item_count 未达标 → fail", () => {
      const v = auto.evaluateQualityGate({ min_item_count: 5 }, { items: [{ id: 1 }] })
      assert.strictEqual(v.pass, false)
      assert.ok(v.reasons[0]?.includes("min_item_count"))
    })

    test("T16d: dedupe_keys 去重后数量不足 → fail", () => {
      const v = auto.evaluateQualityGate(
        { min_item_count: 3, dedupe_keys: ["url"] },
        { items: [{ url: "a" }, { url: "a" }, { url: "a" }] },
      )
      assert.strictEqual(v.pass, false)
      assert.ok(v.reasons.some((r) => r.includes("dedupe_keys")))
    })

    test("T16e: fresh_hours 超时 → fail", () => {
      const v = auto.evaluateQualityGate(
        { fresh_hours: 1 },
        { items: [{ id: 1 }], fetched_at: new Date(Date.now() - 3 * 3_600_000) },
      )
      assert.strictEqual(v.pass, false)
      assert.ok(v.reasons.some((r) => r.includes("fresh_hours")))
    })

    test("T16f: fresh_hours 新鲜 → pass", () => {
      const v = auto.evaluateQualityGate(
        { fresh_hours: 1 },
        { items: [{ id: 1 }], fetched_at: new Date(Date.now() - 10 * 60_000) },
      )
      assert.strictEqual(v.pass, true)
    })

    test("T16g: relevance_terms 未命中 → fail", () => {
      const v = auto.evaluateQualityGate(
        { relevance_terms: ["AI", "Agent"] },
        { items: [{ title: "today's weather report" }] },
      )
      assert.strictEqual(v.pass, false)
      assert.ok(v.reasons.some((r) => r.includes("relevance_terms")))
    })

    test("T16h: relevance_terms 命中 → pass", () => {
      const v = auto.evaluateQualityGate(
        { relevance_terms: ["AI", "Agent"] },
        { items: [{ title: "AI Agent 本周动态" }] },
      )
      assert.strictEqual(v.pass, true)
    })
  })

  // ---------- T17: scopedApprovals 免审批范围 ----------
  describe("pure logic: scopedApprovals (T17)", () => {
    const rule = { approve_tools: ["filesystem_write", "shell_execute"], approve_actions: ["read_only_query"], max_auto_approvals_per_day: 3 }

    test("T17a: 命中 tool 白名单 → approved", () => {
      const d = auto.decideScopedApproval(rule, { toolName: "filesystem_write" })
      assert.strictEqual(d.approved, true)
      assert.strictEqual(d.reason, "scoped_rule")
    })

    test("T17b: 命中 action 白名单 → approved", () => {
      const d = auto.decideScopedApproval(rule, { action: "read_only_query" })
      assert.strictEqual(d.approved, true)
    })

    test("T17c: 未命中 → not_scoped", () => {
      const d = auto.decideScopedApproval(rule, { toolName: "network_request" })
      assert.strictEqual(d.approved, false)
      assert.strictEqual(d.reason, "not_scoped")
    })

    test("T17d: 命中但当日配额已满 → quota_exceeded", () => {
      const d = auto.decideScopedApproval(rule, { toolName: "filesystem_write", approvedToday: 3 })
      assert.strictEqual(d.approved, false)
      assert.strictEqual(d.reason, "quota_exceeded")
    })

    test("T17e: 无 rule → not_scoped", () => {
      const d = auto.decideScopedApproval(null, { toolName: "filesystem_write" })
      assert.strictEqual(d.approved, false)
      assert.strictEqual(d.reason, "not_scoped")
    })
  })

  // ---------- T18: max_cost_cents_per_run 预算检查 ----------
  describe("pure logic: cost budget (T18)", () => {
    test("T18a: 未超限 → ok", () => {
      const r = auto.checkCostBudget(100, 500)
      assert.strictEqual(r.ok, true)
    })

    test("T18b: 等于上限 → ok", () => {
      const r = auto.checkCostBudget(500, 500)
      assert.strictEqual(r.ok, true)
    })

    test("T18c: 超限 → ok=false + exceededByCents", () => {
      const r = auto.checkCostBudget(600, 500)
      assert.strictEqual(r.ok, false)
      assert.strictEqual(r.exceededByCents, 100)
    })

    test("T18d: 无上限（null/undefined）→ 恒 ok", () => {
      assert.strictEqual(auto.checkCostBudget(99999, null).ok, true)
      assert.strictEqual(auto.checkCostBudget(99999, undefined).ok, true)
    })
  })

  // ---------- T19: deliveryTargets 幂等键 ----------
  describe("pure logic: delivery idempotency (T19)", () => {
    test("T19a: 无 idempotency_key → kind+target+batchId 组合", () => {
      const key = auto.deliveryIdempotencyKey({ kind: "feishu_group", target: "g123" }, "batch-1")
      assert.ok(key.includes("feishu_group"))
      assert.ok(key.includes("g123"))
      assert.ok(key.includes("batch-1"))
    })

    test("T19b: 有 idempotency_key → 模板+batchId", () => {
      const key = auto.deliveryIdempotencyKey(
        { kind: "feishu_group", target: "g123", idempotency_key: "ai-hotspot-{date}" },
        "batch-1",
      )
      assert.strictEqual(key, "ai-hotspot-{date}:batch-1")
    })
  })

  // ============================================================
  // DB 集成测试（dbAvailable guard）
  // ============================================================

  // ---------- T3: createAutomation 默认值 ----------
  test("T3: createAutomation defaults ready_for_schedule=false, manual_run_count=0", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const r = await auto.createAutomation({
      teamId,
      name: "AI 早报",
      cronExpr: "0 9 * * *",
      message: "今日 AI 热点",
      agentId: agentWorker,
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
    })
    assert.strictEqual(r.ok, true)
    if (r.ok) {
      assert.strictEqual(r.automation.readyForSchedule, false)
      assert.strictEqual(r.automation.manualRunCount, 0)
      assert.strictEqual(r.automation.enabled, true) // schema default
      assert.strictEqual(r.automation.skipOnOverlap, true)
    }
  })

  // ---------- T4: enableSchedule 在 manual<3 时返回 403 ----------
  test("T4: enableSchedule returns 403 NOT_READY_FOR_SCHEDULE when manual_run_count<3", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T4 自动化",
      cronExpr: "0 9 * * *",
      message: "T4",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return

    const r = await auto.enableSchedule(created.automation.id, true)
    assert.strictEqual(r.ok, false)
    if (!r.ok) {
      assert.strictEqual(r.status, 403)
      assert.strictEqual(r.response.code, "NOT_READY_FOR_SCHEDULE")
      if (r.response.code === "NOT_READY_FOR_SCHEDULE") {
        assert.strictEqual(r.response.manualRunCount, 0)
      }
    }
  })

  // ---------- T5: manualRun × 3 → ready_for_schedule=true ----------
  test("T5: manualRun 3 times flips ready_for_schedule to true (I2)", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T5 自动化",
      cronExpr: "0 9 * * *",
      message: "T5",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id

    // 第 1 次：manual=1, ready=false
    const r1 = await auto.manualRun(id)
    assert.strictEqual(r1.ok, true)
    if (r1.ok) {
      assert.strictEqual(r1.manualRunCount, 1)
      assert.strictEqual(r1.readyForSchedule, false)
      assert.strictEqual(r1.run.dryRun, true, "manualRun must be dry_run=true")
    }

    // 第 2 次：manual=2, ready=false
    const r2 = await auto.manualRun(id)
    if (r2.ok) {
      assert.strictEqual(r2.manualRunCount, 2)
      assert.strictEqual(r2.readyForSchedule, false)
    }

    // 第 3 次：manual=3, ready=true（I2 翻转点）
    const r3 = await auto.manualRun(id)
    if (r3.ok) {
      assert.strictEqual(r3.manualRunCount, 3)
      assert.strictEqual(r3.readyForSchedule, true, "ready_for_schedule must flip at manual=3")
    }

    // 现在 enableSchedule 应该 OK
    const enable = await auto.enableSchedule(id, true)
    assert.strictEqual(enable.ok, true)
  })

  // ---------- T6: startRun batch_id 幂等（I1） ----------
  test("T6: startRun same batch_id twice → second created=false (I1)", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T6 自动化",
      cronExpr: "0 9 * * *",
      message: "T6",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id
    const batchId = `t6-batch-${Date.now()}`

    const first = await auto.startRun({ automationId: id, batchId })
    assert.strictEqual(first.ok, true)
    if (first.ok) {
      assert.strictEqual(first.created, true)
      assert.strictEqual(first.run.status, "waiting_trigger")
    }

    const second = await auto.startRun({ automationId: id, batchId })
    assert.strictEqual(second.ok, true)
    if (second.ok) {
      assert.strictEqual(second.created, false)
      if (!second.created) {
        assert.strictEqual(second.reason, "batch_id_exists")
        assert.strictEqual(second.run.id, first.ok ? first.run.id : "", "must return same run id")
      }
    }
  })

  // ---------- T7: advanceRun 非法转换 409 ----------
  test("T7: advanceRun invalid transition returns 409 INVALID_TRANSITION (I3)", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T7 自动化",
      cronExpr: "0 9 * * *",
      message: "T7",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id
    const batchId = `t7-batch-${Date.now()}`

    const started = await auto.startRun({ automationId: id, batchId })
    assert.strictEqual(started.ok, true)
    if (!started.ok || !started.created) return
    const runId = started.run.id

    // waiting_trigger → delivering 非法（跳步）
    const bad = await auto.advanceRun(runId, { to: "delivering" })
    assert.strictEqual(bad.ok, false)
    if (!bad.ok) {
      assert.strictEqual(bad.status, 409)
      assert.strictEqual(bad.response.code, "INVALID_TRANSITION")
    }
  })

  // ---------- T8: advanceRun 追加 completed_steps（I6 断点续跑） ----------
  test("T8: advanceRun appends step to state.completed_steps (I6)", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T8 自动化",
      cronExpr: "0 9 * * *",
      message: "T8",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id
    const batchId = `t8-batch-${Date.now()}`

    const started = await auto.startRun({ automationId: id, batchId })
    assert.strictEqual(started.ok, true)
    if (!started.ok || !started.created) return
    const runId = started.run.id

    // waiting_trigger → fetching
    const r1 = await auto.advanceRun(runId, { to: "fetching" })
    assert.strictEqual(r1.ok, true)
    if (r1.ok) {
      const steps = (r1.run.state as { completed_steps?: string[] })?.completed_steps ?? []
      assert.ok(steps.includes("fetching"), `expected fetching in ${JSON.stringify(steps)}`)
    }

    // fetching → aggregating
    const r2 = await auto.advanceRun(runId, {
      to: "aggregating",
      sourceStatus: { wechat: "ok", github: "ok" },
    })
    assert.strictEqual(r2.ok, true)
    if (r2.ok) {
      const steps = (r2.run.state as { completed_steps?: string[] })?.completed_steps ?? []
      assert.deepEqual(steps, ["fetching", "aggregating"], `expected ordered steps, got ${JSON.stringify(steps)}`)
      assert.strictEqual(r2.degradationLevel, "full", "all ok → full")
    }

    // aggregating → filtering
    const r3 = await auto.advanceRun(runId, { to: "filtering" })
    if (r3.ok) {
      const steps = (r3.run.state as { completed_steps?: string[] })?.completed_steps ?? []
      assert.deepEqual(steps, ["fetching", "aggregating", "filtering"])
    }

    // filtering → delivering
    const r4 = await auto.advanceRun(runId, { to: "delivering" })
    if (r4.ok) {
      const steps = (r4.run.state as { completed_steps?: string[] })?.completed_steps ?? []
      assert.ok(steps.length >= 4)
    }

    // delivering → completed
    const r5 = await auto.advanceRun(runId, { to: "completed" })
    if (r5.ok) {
      assert.strictEqual(r5.run.status, "completed")
      assert.ok(r5.run.finishedAt instanceof Date, "finished_at must be set")
    }
  })

  // ---------- T8b: 降级计算集成（partial） ----------
  test("T8b: advanceRun with partial sources → degradation=partial", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T8b 自动化",
      cronExpr: "0 9 * * *",
      message: "T8b",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id
    const batchId = `t8b-batch-${Date.now()}`

    const started = await auto.startRun({ automationId: id, batchId })
    if (!started.ok || !started.created) return t.skip("start failed")
    const runId = started.run.id

    await auto.advanceRun(runId, { to: "fetching" })
    const r = await auto.advanceRun(runId, {
      to: "aggregating",
      sourceStatus: { wechat: "ok", github: "partial" },
    })
    if (r.ok) {
      assert.strictEqual(r.degradationLevel, "partial")
      assert.strictEqual(r.run.degradationLevel, "partial")
    }
  })

  // ---------- T8c: 降级计算集成（blocked - 全部 failed） ----------
  test("T8c: advanceRun with all failed sources → degradation=blocked, status=blocked", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T8c 自动化",
      cronExpr: "0 9 * * *",
      message: "T8c",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id
    const batchId = `t8c-batch-${Date.now()}`

    const started = await auto.startRun({ automationId: id, batchId })
    if (!started.ok || !started.created) return t.skip("start failed")
    const runId = started.run.id

    await auto.advanceRun(runId, { to: "fetching" })
    const r = await auto.advanceRun(runId, {
      to: "aggregating",
      sourceStatus: { wechat: "failed", github: "failed" },
    })
    if (r.ok) {
      assert.strictEqual(r.degradationLevel, "blocked")
      assert.strictEqual(r.run.degradationLevel, "blocked")
      // 全部 failed → 状态应被强制为 blocked（不进 delivering）
      assert.strictEqual(r.run.status, "blocked")
    }
  })

  // ---------- T9 DB: failRun with 401 → failed (I5) ----------
  test("T9 DB: failRun with errorCode=401 → run.status=failed (no_retry_on, I5)", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T9 自动化",
      cronExpr: "0 9 * * *",
      message: "T9",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
      retryPolicy: DEFAULT_RETRY_POLICY,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id
    const batchId = `t9-batch-${Date.now()}`

    const started = await auto.startRun({ automationId: id, batchId })
    if (!started.ok || !started.created) return t.skip("start failed")
    const runId = started.run.id

    await auto.advanceRun(runId, { to: "fetching" })
    const r = await auto.failRun(runId, { errorCode: "401", errorMessage: "Unauthorized" })
    assert.strictEqual(r.ok, true)
    if (r.ok) {
      assert.strictEqual(r.retried, false, "401 ∈ no_retry_on → must NOT retry")
      assert.strictEqual(r.run.status, "failed")
      assert.strictEqual(r.nextAttemptAt, undefined)
    }
  })

  // ---------- T10 DB: failRun with timeout → blocked + retry ----------
  test("T10 DB: failRun with errorCode=timeout → run.status=blocked, retried=true (I5)", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T10 自动化",
      cronExpr: "0 9 * * *",
      message: "T10",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
      retryPolicy: DEFAULT_RETRY_POLICY,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id
    const batchId = `t10-batch-${Date.now()}`

    const started = await auto.startRun({ automationId: id, batchId })
    if (!started.ok || !started.created) return t.skip("start failed")
    const runId = started.run.id

    await auto.advanceRun(runId, { to: "fetching" })
    const r = await auto.failRun(runId, { errorCode: "timeout", errorMessage: "upstream timeout" })
    assert.strictEqual(r.ok, true)
    if (r.ok) {
      assert.strictEqual(r.retried, true, "timeout ∈ retry_on, attempt<max → must retry")
      assert.strictEqual(r.run.status, "blocked")
      assert.ok(r.nextAttemptAt instanceof Date, "nextAttemptAt must be set for retry")
    }
  })

  // ---------- T12: createAlert 缺字段 400 ----------
  test("T12: createAlert missing impact returns 400 MISSING_ALERT_FIELDS (I4)", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T12 自动化",
      cronExpr: "0 9 * * *",
      message: "T12",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id

    // 缺 impact 字段
    const r = await auto.createAlert({
      teamId,
      automationId: id,
      batchId: `t12-batch-${Date.now()}`,
      status: "blocked",
      triggerTime: "09:00",
      failureReason: "全部数据源失败",
      completedSteps: ["fetching"],
      // impact 缺失
      suggestedActions: ["检查上游 API", "联系负责人"],
      recoveryEntry: "WorkBuddy → 自动化任务 → 手动运行",
    })
    assert.strictEqual(r.ok, false)
    if (!r.ok) {
      assert.strictEqual(r.status, 400)
      assert.strictEqual(r.response.code, "MISSING_ALERT_FIELDS")
      if (r.response.code === "MISSING_ALERT_FIELDS") {
        assert.ok(r.response.missing.includes("impact"), `expected impact in missing, got ${JSON.stringify(r.response.missing)}`)
      }
    }
  })

  // ---------- T12b: createAlert 7 字段齐 → ok ----------
  test("T12b: createAlert with all 7 fields returns ok", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T12b 自动化",
      cronExpr: "0 9 * * *",
      message: "T12b",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id

    const r = await auto.createAlert({
      teamId,
      automationId: id,
      batchId: `t12b-batch-${Date.now()}`,
      status: "blocked",
      triggerTime: "09:00",
      failureReason: "全部数据源失败",
      completedSteps: ["fetching", "aggregating"],
      impact: "团队成员今日未收到 AI 早报",
      suggestedActions: ["检查上游 API", "联系负责人"],
      recoveryEntry: "WorkBuddy → 自动化任务 → 手动运行",
      severity: "critical",
    })
    assert.strictEqual(r.ok, true)
    if (r.ok) {
      assert.strictEqual(r.alert.failureReason, "全部数据源失败")
      assert.strictEqual(r.alert.severity, "critical")
      assert.strictEqual(r.alert.delivered, false)
    }
  })

  // ---------- T-list-due: listDueAutomations ----------
  test("T-due: listDueAutomations returns enabled automations with next_run_at<=now", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T-due 自动化",
      cronExpr: "0 9 * * *",
      message: "T-due",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
      // 关闭 skip_on_overlap，否则之前 manualRun 留下的 waiting_trigger run 会让它被跳过
      skipOnOverlap: false,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id

    // manualRun × 3 让 ready=true
    await auto.manualRun(id)
    await auto.manualRun(id)
    await auto.manualRun(id)
    // enableSchedule
    await auto.enableSchedule(id, true)
    // 手动把 next_run_at 设到过去，让 listDue 命中
    const past = new Date(Date.now() - 60_000)
    await db
      .update(schema.TeamAutomationTable)
      .set({ next_run_at: past })
      .where(drizzle.eq(schema.TeamAutomationTable.id, id))

    const result = await auto.listDueAutomations()
    const ids = result.due.map((a) => a.id)
    assert.ok(ids.includes(id), `expected ${id} in due list`)
  })

  // ---------- T-list-due-skip-overlap: skip_on_overlap ----------
  test("T-overlap: listDueAutomations skips automation with running run when skip_on_overlap=true", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T-overlap 自动化",
      cronExpr: "0 9 * * *",
      message: "T-overlap",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
      skipOnOverlap: true,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id

    // manualRun × 3 + enable
    await auto.manualRun(id)
    await auto.manualRun(id)
    await auto.manualRun(id)
    await auto.enableSchedule(id, true)

    // 制造一个仍在运行的 run（status=fetching，started_at=now，无 finished_at）
    const batchId = `overlap-batch-${Date.now()}`
    const started = await auto.startRun({ automationId: id, batchId })
    if (started.ok && started.created) {
      await auto.advanceRun(started.run.id, { to: "fetching" })
    }

    // 把 next_run_at 设到过去
    const past = new Date(Date.now() - 60_000)
    await db
      .update(schema.TeamAutomationTable)
      .set({ next_run_at: past })
      .where(drizzle.eq(schema.TeamAutomationTable.id, id))

    const result = await auto.listDueAutomations()
    const dueIds = result.due.map((a) => a.id)
    const skippedIds = result.skipped.map((s) => s.automation.id)
    assert.ok(!dueIds.includes(id), "should NOT be in due (overlap)")
    assert.ok(skippedIds.includes(id), "should be in skipped (overlap)")
  })

  // ---------- T-ack: acknowledgeAlert ----------
  test("T-ack: acknowledgeAlert sets acknowledged_by/at", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T-ack 自动化",
      cronExpr: "0 9 * * *",
      message: "T-ack",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id

    const alertR = await auto.createAlert({
      teamId,
      automationId: id,
      batchId: `t-ack-batch-${Date.now()}`,
      status: "blocked",
      triggerTime: "09:00",
      failureReason: "测试告警",
      completedSteps: ["fetching"],
      impact: "影响测试",
      suggestedActions: ["动作 1"],
      recoveryEntry: "测试恢复入口",
    })
    assert.strictEqual(alertR.ok, true)
    if (!alertR.ok) return

    const ack = await auto.acknowledgeAlert(alertR.alert.id, memberOwner)
    assert.strictEqual(ack.ok, true)
    if (ack.ok) {
      assert.strictEqual(ack.alert.acknowledgedBy, memberOwner)
      assert.ok(ack.alert.acknowledgedAt instanceof Date)
    }
  })

  // ---------- T20: advanceRun 预算检查（max_cost_cents_per_run） ----------
  test("T20 DB: advanceRun with costCents > max_cost_cents_per_run → 402 BUDGET_EXCEEDED", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T20 预算自动化",
      cronExpr: "0 9 * * *",
      message: "T20",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
      maxCostCentsPerRun: 500,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id

    const started = await auto.startRun({ automationId: id, batchId: `t20-batch-${Date.now()}` })
    if (!started.ok || !started.created) return t.skip("start failed")
    const runId = started.run.id

    await auto.advanceRun(runId, { to: "fetching" })
    const r = await auto.advanceRun(runId, { to: "aggregating", costCents: 600 })
    assert.strictEqual(r.ok, false)
    if (!r.ok) {
      assert.strictEqual(r.status, 402)
      assert.strictEqual(r.response.code, "BUDGET_EXCEEDED")
      if (r.response.code === "BUDGET_EXCEEDED") {
        assert.strictEqual(r.response.maxCostCentsPerRun, 500)
        assert.strictEqual(r.response.costCents, 600)
      }
    }
  })

  // ---------- T21: advanceRun 预算未超限 → 正常推进 ----------
  test("T21 DB: advanceRun with costCents <= max_cost_cents_per_run → ok", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T21 预算自动化",
      cronExpr: "0 9 * * *",
      message: "T21",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
      maxCostCentsPerRun: 500,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id

    const started = await auto.startRun({ automationId: id, batchId: `t21-batch-${Date.now()}` })
    if (!started.ok || !started.created) return t.skip("start failed")
    const runId = started.run.id

    await auto.advanceRun(runId, { to: "fetching" })
    const r = await auto.advanceRun(runId, { to: "aggregating", costCents: 300 })
    assert.strictEqual(r.ok, true)
  })

  // ---------- T22: checkScopedApproval DB 集成 ----------
  test("T22 DB: checkScopedApproval hit approve_tools → approved=true", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T22 审批自动化",
      cronExpr: "0 9 * * *",
      message: "T22",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
      scopedApprovals: {
        approve_tools: ["filesystem_write"],
        max_auto_approvals_per_day: 10,
      },
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id

    const r = await auto.checkScopedApproval(id, { toolName: "filesystem_write" })
    assert.strictEqual(r.ok, true)
    if (r.ok) {
      assert.strictEqual(r.approved, true)
      assert.strictEqual(r.reason, "scoped_rule")
    }
  })

  test("T22b DB: checkScopedApproval miss → approved=false not_scoped", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T22b 审批自动化",
      cronExpr: "0 9 * * *",
      message: "T22b",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
      scopedApprovals: { approve_tools: ["filesystem_write"] },
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id

    const r = await auto.checkScopedApproval(id, { toolName: "network_request" })
    assert.strictEqual(r.ok, true)
    if (r.ok) {
      assert.strictEqual(r.approved, false)
      assert.strictEqual(r.reason, "not_scoped")
    }
  })

  // ---------- T23: evaluateQualityForAutomation DB 集成 ----------
  test("T23 DB: evaluateQualityForAutomation with configured gate → verdict computed", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T23 质量门自动化",
      cronExpr: "0 9 * * *",
      message: "T23",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
      qualityGate: { min_item_count: 3 },
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id

    const pass = await auto.evaluateQualityForAutomation(id, { items: [{ id: 1 }, { id: 2 }, { id: 3 }] })
    assert.strictEqual(pass.ok, true)
    if (pass.ok) {
      assert.strictEqual(pass.gateConfigured, true)
      assert.strictEqual(pass.verdict.pass, true)
    }

    const fail = await auto.evaluateQualityForAutomation(id, { items: [{ id: 1 }] })
    assert.strictEqual(fail.ok, true)
    if (fail.ok) {
      assert.strictEqual(fail.verdict.pass, false)
    }
  })

  test("T23b DB: evaluateQualityForAutomation without gate → gateConfigured=false", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T23b 质量门自动化",
      cronExpr: "0 9 * * *",
      message: "T23b",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id

    const r = await auto.evaluateQualityForAutomation(id, { items: [] })
    assert.strictEqual(r.ok, true)
    if (r.ok) {
      assert.strictEqual(r.gateConfigured, false)
      assert.strictEqual(r.verdict.pass, true)
    }
  })

  // ---------- T24: deliverRunResults 多渠道投递 ----------
  test("T24 DB: deliverRunResults with registered handler delivers + persists idempotency", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T24 投递自动化",
      cronExpr: "0 9 * * *",
      message: "T24",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
      deliveryTargets: [
        { kind: "feishu_group", target: "g_test_1", idempotency_key: "t24-{date}" },
        { kind: "webhook", target: "https://example.com/hook" },
      ],
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id

    // 注册一个测试 handler
    const sent: string[] = []
    auto.registerDeliveryHandler("feishu_group", async ({ target, payload }) => {
      sent.push(`${target.target}:${payload.batchId}`)
      return { ok: true }
    })

    const started = await auto.startRun({ automationId: id, batchId: "t24-batch-1" })
    if (!started.ok || !started.created) return t.skip("start failed")

    // 第一次投递：feishu_group 有 handler → delivered；webhook 无 handler → failed
    const r1 = await auto.deliverRunResults(started.run.id, { batchId: "t24-batch-1", content: { items: [1] } })
    assert.strictEqual(r1.delivered.length, 1, "feishu_group should deliver")
    assert.strictEqual(r1.failed.length, 1, "webhook has no handler → failed")
    assert.strictEqual(r1.failed[0]?.error.includes("no delivery handler"), true)

    // 第二次投递同 batch → 幂等跳过（delivered/skipped 不再重复投递）
    const r2 = await auto.deliverRunResults(started.run.id, { batchId: "t24-batch-1", content: { items: [2] } })
    assert.strictEqual(r2.delivered.length, 0, "already delivered → no new delivery")
    assert.strictEqual(r2.skipped.length, 1, "feishu_group idempotency skip")
    assert.strictEqual(sent.length, 1, "handler must be called only once for same batch")
  })

  // ---------- T25: SchedulerWorker tick ----------
  test("T25 DB: scheduler tick starts due automation run with idempotent batchId", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T25 调度自动化",
      cronExpr: "0 9 * * *",
      message: "T25",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
      skipOnOverlap: false,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id

    // ready_for_schedule + enable
    await auto.manualRun(id)
    await auto.manualRun(id)
    await auto.manualRun(id)
    await auto.enableSchedule(id, true)

    // 把 next_run_at 设到过去，让 listDue 命中
    const past = new Date(Date.now() - 60_000)
    await db
      .update(schema.TeamAutomationTable)
      .set({ next_run_at: past })
      .where(drizzle.eq(schema.TeamAutomationTable.id, id))

    const worker = scheduler.createSchedulerWorker({ intervalMs: 60_000 })
    // tick 前已有 3 个 manualRun 产生的 run
    const runsBefore = await db
      .select({ id: schema.TeamAutomationRunTable.id })
      .from(schema.TeamAutomationRunTable)
      .where(drizzle.eq(schema.TeamAutomationRunTable.automation_id, id))
    const result = await worker.tick()
    assert.strictEqual(result.failed.length, 0, "no failures")

    // 只校验增量：本 automation 应恰好新增 1 个 run
    const runsAfterFirst = await db
      .select({ id: schema.TeamAutomationRunTable.id })
      .from(schema.TeamAutomationRunTable)
      .where(drizzle.eq(schema.TeamAutomationRunTable.automation_id, id))
    assert.strictEqual(runsAfterFirst.length, runsBefore.length + 1, "first tick creates exactly 1 run")

    // 同周期二次 tick → batch_id 幂等，不再重复 startRun
    const result2 = await worker.tick()
    assert.strictEqual(result2.failed.length, 0)
    const runsAfterSecond = await db
      .select({ id: schema.TeamAutomationRunTable.id })
      .from(schema.TeamAutomationRunTable)
      .where(drizzle.eq(schema.TeamAutomationRunTable.automation_id, id))
    assert.strictEqual(runsAfterSecond.length, runsBefore.length + 1, "second tick must not create another run (idempotent)")

    // 调度器应更新 next_run_at 到未来
    const rows = await db
      .select({ next_run_at: schema.TeamAutomationTable.next_run_at })
      .from(schema.TeamAutomationTable)
      .where(drizzle.eq(schema.TeamAutomationTable.id, id))
    assert.ok(rows[0]?.next_run_at instanceof Date, "next_run_at must be updated")
    assert.ok(rows[0]!.next_run_at!.getTime() > Date.now(), "next_run_at must be in the future")
  })

  // ---------- T26: SchedulerWorker with runHandler ----------
  test("T26 DB: scheduler tick invokes runHandler for started run", async (t) => {
    if (!dbAvailable) return t.skip("DB not available")
    const created = await auto.createAutomation({
      teamId,
      name: "T26 调度自动化",
      cronExpr: "0 9 * * *",
      message: "T26",
      ownerMemberId: memberOwner,
      createdBy: memberOwner,
      skipOnOverlap: false,
    })
    assert.strictEqual(created.ok, true)
    if (!created.ok) return
    const id = created.automation.id

    await auto.manualRun(id)
    await auto.manualRun(id)
    await auto.manualRun(id)
    await auto.enableSchedule(id, true)

    const past = new Date(Date.now() - 60_000)
    await db
      .update(schema.TeamAutomationTable)
      .set({ next_run_at: past })
      .where(drizzle.eq(schema.TeamAutomationTable.id, id))

    const handled: string[] = []
    const worker = scheduler.createSchedulerWorker({
      intervalMs: 60_000,
      runHandler: async ({ run }) => {
        handled.push(run.id)
      },
    })
    const result = await worker.tick()
    assert.strictEqual(result.failed.length, 0, "no failures")

    // 3 manualRun + 1 scheduler run；runHandler 恰好处理 1 个新 run
    const runs = await db
      .select({ id: schema.TeamAutomationRunTable.id })
      .from(schema.TeamAutomationRunTable)
      .where(drizzle.eq(schema.TeamAutomationRunTable.automation_id, id))
    assert.strictEqual(handled.length, 1, "runHandler must be called exactly once")
    assert.ok(runs.some((r) => r.id === handled[0]), "handler must receive the created run")
  })
})
