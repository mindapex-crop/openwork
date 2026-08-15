/**
 * Service barrel — single public surface for all team-autonomy logic.
 *
 * MIGRATION PHASE (phase-1-core → L3 plugin):
 *   Right now the implementations still live under
 *   @openwork-ee/den-api/src/team-autonomy/*.ts. We re-export them through
 *   this barrel so callers import from @openwork-ee/team-autonomy/db (see
 *   ../db/index.ts) and become agnostic to where the source lives. The
 *   actual file-by-file move happens in follow-up commits — once everything
 *   has been hoisted here, we can drop the dynamic imports in
 *   ../http/routes.ts and ../auth/hook.ts and import directly from this
 *   package.
 *
 * Service inventory (from OpenSpecs / P0..P3 work):
 *   AssetService          – artifact state machine + versions          (P0)
 *   PermissionService     – first-responder-wins + standing rules      (P0)
 *   InboxService          – approvals + notifications                   (P0)
 *   TaskService           – dep graph + handoff + plan approval        (P1 ①)
 *   TeamAgentService      – agent pool + role contract + forbidden     (P1 ②)
 *   AutomationService     – state machine + retry + degradation +alerts(P1 ③)
 *   SkillValidationService– triple validation + bait tests             (P2 ②)
 *   BudgetService         – wallet + allocation + drain ledger
 *   MailboxService        – async cross-team messages
 *   PersonalTeamService   – idempotent personal team ensure
 *   SidecarService        – process pool / CLI agent launcher
 *   SchedulerWorker       – cron + polling + run-loop driver
 *
 * NOTE: Cross-workspace static re-exports don't typecheck under
 *       `tsc --noEmit` because den-api's package.json doesn't declare those
 *       internal src/ paths as exports. That's fine for a MIGRATION bridge
 *       — at runtime node/tsx resolves these via pnpm symlinks.
 *       We wrap each one in a ts-ignore and replace them incrementally.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - migration bridge (see block comment above)
export * from "@openwork-ee/den-api/src/team-autonomy/asset-service.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - migration bridge
export * from "@openwork-ee/den-api/src/team-autonomy/automation-service.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - migration bridge
export * from "@openwork-ee/den-api/src/team-autonomy/budget-service.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - migration bridge
export * from "@openwork-ee/den-api/src/team-autonomy/inbox-service.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - migration bridge
export * from "@openwork-ee/den-api/src/team-autonomy/mailbox-service.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - migration bridge
export * from "@openwork-ee/den-api/src/team-autonomy/permission-service.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - migration bridge
export * from "@openwork-ee/den-api/src/team-autonomy/personal-team-service.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - migration bridge
export * from "@openwork-ee/den-api/src/team-autonomy/sidecar-service.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - migration bridge
export * from "@openwork-ee/den-api/src/team-autonomy/skill-validation-service.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - migration bridge
export * from "@openwork-ee/den-api/src/team-autonomy/task-service.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - migration bridge
export * from "@openwork-ee/den-api/src/team-autonomy/team-agent-service.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - migration bridge
export * from "@openwork-ee/den-api/src/team-autonomy/personal-team.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - migration bridge
export * from "@openwork-ee/den-api/src/team-autonomy/scheduler-worker.js";
