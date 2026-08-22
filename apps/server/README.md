# OpenWork Server

Filesystem-backed API for OpenWork remote clients. This package provides the OpenWork server layer described in `apps/app/pr/openwork-server.md` and is intentionally independent from the desktop app.

## Agent Team — Multi-Agent Orchestration

The server includes a powerful multi-agent orchestration module (`src/agent-team/`) that coordinates multiple CLI agents to work together on complex tasks.

### Core Concepts

- **AgentTeam** — A team of CLI agents working together with shared configuration and lifecycle management
- **Four Orchestration Modes**: Dispatch, Relay (chain), Broadcast, Fan-out
- **Worktree Isolation** — Each agent gets an independent Git worktree to prevent file conflicts
- **LLM Supervisor** — LLM-driven task decomposition and agent selection
- **Message Bus** — Direct inter-agent communication (direct, broadcast, system messages)
- **Cost-Efficiency Router** — Model recommendation by role based on cost/benefit analysis
- **Process Pool** — Agent process reuse and concurrency control via `SidecarProcessPool`
- **Plan-Act Pattern** — Paired plan/act execution with separate model selection
- **Cloud Context** — Session snapshot store for cross-machine relay resume

### Usage Example

```typescript
import { createAgentTeam, fanOutTask } from "./agent-team/index.js";
import { createAdapterForAgent } from "./agent-sidecar/index.js";

const team = await createAgentTeam({
  teamId: "feature-team",
  members: [
    { agentId: "claude-code", adapter: createAdapterForAgent("claude-code"), role: "primary" },
    { agentId: "codex", adapter: createAdapterForAgent("codex"), role: "reviewer" },
  ],
  dispatchPolicy: { kind: "llm-supervisor", model: "gpt-4" },
  worktreeIsolation: true,
  useProcessPool: true,
}, { cwd: "/path/to/project" });

// Fan-out parallel subtasks
for await (const ev of fanOutTask(team, {
  fanOutId: "feat-1",
  assignments: [
    { agentId: "claude-code", prompt: "Implement feature A" },
    { agentId: "codex", prompt: "Write tests for feature A" },
  ],
})) {
  console.log(ev);
}

// Merge worktree changes back
const result = team.mergeWorktrees({ strategy: "auto-merge", cleanupAfterMerge: true });
await team.stop();
```

### Dispatch Policies

| Policy | Description |
|--------|-------------|
| `round-robin` | Rotate through members sequentially |
| `first-available` | Pick first alive agent |
| `capability-match` | Match agent by required capabilities |
| `primary-with-fallback` | Primary agent with fallback chain |
| `role-based` | Route by member role |
| `llm-supervisor` | LLM-driven intelligent routing |

### Agent Roles

- `primary` — Default agent for most tasks
- `reviewer` — Review and quality check
- `specialist` — Domain expert for capability-matched tasks
- `fallback` — Standby agent
- `observer` — Read-only in broadcast mode

### Worktree Merge Strategies

| Strategy | Description |
|----------|-------------|
| `auto-merge` | Direct `git merge --no-ff` |
| `cherry-pick` | Individual commit cherry-pick |
| `sequential` | Squash commit then merge |

### Module Structure

```
src/agent-team/
├── index.ts              # Public API exports
├── types.ts              # Type definitions
├── team.ts               # AgentTeam lifecycle management
├── dispatch.ts           # Dispatch policy implementations
├── relay.ts              # Relay/broadcast/fan-out orchestration
├── agent-runner.ts       # Single agent prompt runner
├── worktree-manager.ts   # Git worktree isolation + merge
├── message-bus.ts        # Inter-agent communication
├── supervisor.ts         # LLM-driven task router
├── cost-efficiency-router.ts  # Model selection by role/cost
├── plan-act.ts           # Plan-Act paired execution
├── cloud-context.ts     # Cross-machine session snapshot store
├── ssh-relay.ts          # SSH tunnel for remote relay
├── team-strategies.ts    # Team strategy definitions
├── harness-environment.ts # Test harness environment
└── *.test.ts             # Test files
```

## Quick start

```bash
npm install -g openwork-server
openwork-server --workspace /path/to/workspace --approval auto
```

`openwork-server` ships as a compiled binary, so Bun is not required at runtime.

Or from source:

```bash
pnpm --filter openwork-server dev -- \
  --workspace /path/to/workspace \
  --approval auto
```

The server logs the client token and host token on boot when they are auto-generated.

Add `--verbose` to print resolved config details on startup. Use `--version` to print the server version and exit.

## Config file

Defaults to `~/.config/openwork/server.json` (override with `OPENWORK_SERVER_CONFIG` or `--config`).

```json
{
  "host": "127.0.0.1",
  "port": 8787,
  "approval": { "mode": "manual", "timeoutMs": 30000 },
  "workspaces": [
    {
      "path": "/Users/susan/Finance",
      "name": "Finance",
      "workspaceType": "local",
      "baseUrl": "http://127.0.0.1:4096",
      "directory": "/Users/susan/Finance"
    }
  ],
  "corsOrigins": ["http://localhost:5173"]
}
```

## Environment variables

- `OPENWORK_SERVER_CONFIG` path to config JSON
- `OPENWORK_HOST` / `OPENWORK_PORT`
- `OPENWORK_TOKEN` client bearer token
- `OPENWORK_HOST_TOKEN` host approval token
- `OPENWORK_APPROVAL_MODE` (`manual` | `auto`)
- `OPENWORK_APPROVAL_TIMEOUT_MS`
- `OPENWORK_WORKSPACES` (JSON array or comma-separated list of paths)
- `OPENWORK_CORS_ORIGINS` (comma-separated list or `*`)
- `OPENWORK_OPENCODE_BASE_URL`
- `OPENWORK_OPENCODE_DIRECTORY`
- `OPENWORK_OPENCODE_USERNAME`
- `OPENWORK_OPENCODE_PASSWORD`

Token management (scoped tokens):

- `OPENWORK_TOKEN_STORE` path to token store JSON (default: alongside `server.json`)

File injection / artifacts:

- `OPENWORK_INBOX_ENABLED` (`1` | `0`)
- `OPENWORK_INBOX_MAX_BYTES` (default: 50MB, capped)
- `OPENWORK_OUTBOX_ENABLED` (`1` | `0`)

Sandbox advertisement (for capability discovery):

- `OPENWORK_SANDBOX_ENABLED` (`1` | `0`)
- `OPENWORK_SANDBOX_BACKEND` (`docker` | `container` | `none`)

## Endpoints

- `GET /health`
- `GET /status`
- `GET /capabilities`
- `GET /whoami`
- `GET /workspaces`
- `GET /workspace/:id/config`
- `PATCH /workspace/:id/config`
- `GET /workspace/:id/events`
- `POST /workspace/:id/engine/reload`
- `GET /workspace/:id/plugins`
- `POST /workspace/:id/plugins`
- `DELETE /workspace/:id/plugins/:name`
- `GET /workspace/:id/skills`
- `POST /workspace/:id/skills`
- `GET /workspace/:id/mcp`
- `POST /workspace/:id/mcp`
- `DELETE /workspace/:id/mcp/:name`
- `GET /workspace/:id/commands`
- `POST /workspace/:id/commands`
- `DELETE /workspace/:id/commands/:name`
- `GET /workspace/:id/audit`
- `GET /workspace/:id/export`
- `POST /workspace/:id/import/preview`
- `POST /workspace/:id/import`

Token management (host/owner auth):

- `GET /tokens`
- `POST /tokens` (body: `{ "scope": "owner"|"collaborator"|"viewer", "label"?: string }`)
- `DELETE /tokens/:id`

Inbox/outbox:

- `POST /workspace/:id/inbox` (multipart upload into `.opencode/openwork/inbox/`)
- `GET /workspace/:id/artifacts`
- `GET /workspace/:id/artifacts/:artifactId`
- `POST /workspace/:id/files/sessions`
- `POST /files/sessions/:sessionId/renew`
- `DELETE /files/sessions/:sessionId`
- `GET /files/sessions/:sessionId/catalog/snapshot`
- `GET /files/sessions/:sessionId/catalog/events`
- `POST /files/sessions/:sessionId/read-batch`
- `POST /files/sessions/:sessionId/write-batch`
- `POST /files/sessions/:sessionId/ops`

OpenCode proxy:

- `GET|POST|... /opencode/*`
- `GET|POST|... /w/:id/opencode/*`

## Approvals

All writes are gated by host approval.

Host APIs accept either:

- `X-OpenWork-Host-Token: <token>` (legacy host token), or
- `Authorization: Bearer <token>` where the token scope is `owner`.

Approvals endpoints:

- `GET /approvals`
- `POST /approvals/:id` with `{ "reply": "allow" | "deny" }`

Set `OPENWORK_APPROVAL_MODE=auto` to auto-approve during local development.
