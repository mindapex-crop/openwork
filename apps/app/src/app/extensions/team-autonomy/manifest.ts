/**
 * Team Autonomy extension — OpenWork extension manifest.
 *
 * This is the Phase 2 extension manifest for MindApex's team autonomy
 * feature set. It declares:
 *  - 52 `server-route` contributions (HTTP API surface)
 *  - `settings-panel` for team autonomy configuration
 *  - `session-side-panel` for runtime reporting
 *  - `composer-prompt` for team task creation
 *  - `local-service` resource for the Generic CLI agent adapter
 *
 * ⚠️ Prerequisites (Phase 1, must land in core before this extension works):
 *  - 6 new database tables (assets / tasks / agents / inbox / permissions / automations)
 *    via drizzle migrations in ee/packages/den-db/
 *  - personal-team auto-create hook in ee/apps/den-api/src/auth.ts
 *  - agent-team relay architecture in apps/server/src/
 *  - desktop VITE_DEN_BASE_URL config in apps/desktop/electron/main.mjs
 *
 * Layout: this manifest lives alongside the migrated route files
 * (which will move from ee/apps/den-api/src/routes/team-autonomy/ into
 * this extension's server-routes/ directory). Until the migration is
 * done, the actual route handlers still live in the den-api server;
 * the manifest here is the contract that will govern them.
 */

import type { OpenWorkExtensionManifest } from "../../extensions";

/**
 * All 52 HTTP routes exposed by the team autonomy feature.
 * Extracted from `git show feat/team-autonomy:ee/apps/den-api/src/routes/team-autonomy/*.ts`.
 *
 * `ref` follows the OpenWork `server-route` convention:
 *   "METHOD /path"  (e.g. "GET /api/teams/:teamId/agents")
 *
 * Routed through the den-api server under the shared prefix
 * `/api/teams/:teamId/...`.
 */
const teamAutonomyServerRoutes: Array<{
  type: "server-route";
  location: "server";
  ref: string;
}> = [
  // ===== agents.ts (9) =====
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/agents" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/agents" },
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/agents/:agentId" },
  { type: "server-route", location: "server", ref: "PATCH /api/teams/:teamId/agents/:agentId" },
  { type: "server-route", location: "server", ref: "DELETE /api/teams/:teamId/agents/:agentId" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/agents/:agentId/assign/:taskId" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/agents/:agentId/unassign" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/agents/:agentId/pause" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/agents/:agentId/resume" },

  // ===== tasks.ts (10) =====
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/tasks" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/tasks" },
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/tasks/:taskId" },
  { type: "server-route", location: "server", ref: "PATCH /api/teams/:teamId/tasks/:taskId/status" },
  { type: "server-route", location: "server", ref: "PUT /api/teams/:teamId/tasks/:taskId/plan" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/tasks/:taskId/plan/approve" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/tasks/:taskId/plan/reject" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/tasks/:taskId/handoff" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/tasks/:taskId/dependencies" },
  { type: "server-route", location: "server", ref: "DELETE /api/teams/:teamId/tasks/:taskId/dependencies/:dependsOnId" },

  // ===== boards.ts (4) =====
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/boards" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/boards" },
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/boards/:boardId" },
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/boards/:boardId/tasks" },

  // ===== artifacts.ts (6) =====
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/artifacts" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/artifacts" },
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/artifacts/:artifactId" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/artifacts/:artifactId/transition" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/artifacts/:artifactId/versions" },
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/artifacts/:artifactId/versions/:version" },

  // ===== automation.ts (13) =====
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/automations" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/automations" },
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/automations/runs/:runId" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/automations/runs/:runId/advance" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/automations/runs/:runId/fail" },
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/automations/alerts" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/automations/alerts" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/automations/alerts/:alertId/acknowledge" },
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/automations/:automationId" },
  { type: "server-route", location: "server", ref: "PATCH /api/teams/:teamId/automations/:automationId" },
  { type: "server-route", location: "server", ref: "PATCH /api/teams/:teamId/automations/:automationId/schedule" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/automations/:automationId/manual-run" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/automations/:automationId/runs" },

  // ===== inbox.ts (4) =====
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/inbox" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/inbox" },
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/inbox/:inboxId" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/inbox/:inboxId/resolve" },

  // ===== permissions.ts (6) =====
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/permissions/profile" },
  { type: "server-route", location: "server", ref: "PUT /api/teams/:teamId/permissions/profile" },
  { type: "server-route", location: "server", ref: "GET /api/teams/:teamId/permissions/rules" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/permissions/rules" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/permissions/rules/:ruleId/revoke" },
  { type: "server-route", location: "server", ref: "POST /api/teams/:teamId/permissions/check" },
];

export const TEAM_AUTONOMY_MANIFEST: OpenWorkExtensionManifest = {
  schemaVersion: 1,
  id: "madapex-team-autonomy",
  name: "Team Autonomy",
  description:
    "Multi-agent team orchestration: agents, tasks, boards, artifacts, automations, inbox approvals, and permissions. " +
    "Each team runs its own pool of CLI agent sidecars, coordinated by an orchestration layer with approval gates and " +
    "standing permission rules.",
  source: { format: "openwork-extension-manifest", trusted: true },
  defaultEnabled: true,
  resources: [
    // Generic CLI agent adapter as a local-service resource
    {
      type: "local-service",
      id: "madapex-team-autonomy:generic-cli-adapter",
      description:
        "Generic CLI agent adapter. Spawns an external agent CLI in headless mode " +
        "and proxies commands over a local socket. Fails fast on protocol errors.",
    },
  ],
  contributions: [
    // Phase 1 core prerequisites — must land before this extension activates
    //   - 6 drizzle tables (assets / tasks / agents / inbox / permissions / automations)
    //   - personal-team auto-create hook in auth.ts
    //   - agent-team relay + sidecar architecture in apps/server/src/
    //   - VITE_DEN_BASE_URL config in apps/desktop/

    // 52 HTTP API routes
    ...teamAutonomyServerRoutes,

    // Settings panel for configuring team autonomy
    {
      type: "settings-panel",
      location: "settings-detail",
      ref: "TeamAutonomySettingsPanel",
      label: "Team Autonomy",
      description:
        "Configure team agents, boards, automations, inbox approvals, and permission profiles.",
    },

    // Session side panel for runtime reporting (worktree lifecycle, agent pool status)
    {
      type: "session-side-panel",
      location: "session-right-pane",
      ref: "TeamAutonomyRuntimePanel",
      label: "Team Runtime",
      description: "Live view of agent pool, task graph, and automation runs.",
    },

    // Composer prompt templates for common team autonomy actions
    {
      type: "composer-prompt",
      location: "composer",
      ref: "TeamAutonomyNewTask",
      label: "New team task",
      description: "Create a new task on the team board.",
      prompt: "Create a new task for the team with title, priority, and an assignee.",
    },
    {
      type: "composer-prompt",
      location: "composer",
      ref: "TeamAutonomyApprovePlan",
      label: "Approve task plan",
      description: "Approve a pending task plan.",
      prompt: "Approve the pending plan for this task.",
    },
    {
      type: "composer-prompt",
      location: "composer",
      ref: "TeamAutonomyCreateAutomation",
      label: "New automation",
      description: "Schedule a recurring task run for the team.",
      prompt: "Create a new cron-based automation for the team.",
    },
  ],
};
