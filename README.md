# OpenWork

OpenWork is a free, open-source desktop app made for sharing AI workflows. It is an open-source alternative to Claude Cowork and Codex for macOS, Windows, and Linux.

Add one OpenWork MCP to Codex, Claude Code, Cursor, or another compatible agent and reuse the same skills, MCPs, and connected services across your tools, teammates, and machines. Create something once, share it with coworkers or friends, or keep it for yourself.

The desktop app is there when you want a dedicated workspace, but it is not required. You can use OpenWork from the agent you already have. For larger organizations, the admin interface lets you publish capabilities, manage access, and configure shared or per-user connections.

[**Download OpenWork**](https://openworklabs.com/download)

<img width="1481" height="842" alt="OpenWork desktop app" src="https://github.com/user-attachments/assets/66a8dd9b-5260-488c-957d-e54331e78c1c" />

## Install with your AI agent

Already use an AI agent? Copy this prompt and paste it into Claude Code, Cursor, Codex, ChatGPT, or any agent that can run commands on your computer.

```text
Install OpenWork on my computer, set up my first workspace, and open it ready to use. Follow the steps in https://openworklabs.com/start.md?v=hero
```

1. Installs OpenWork
2. Creates your workspace
3. Opens it ready to run

## Use OpenWork from any agent

The OpenWork MCP brings your assigned skills, plugins, MCP connections, Google Workspace, and Microsoft 365 capabilities into any compatible agent.

It exposes two tools: `search_capabilities` finds what you can use, and `execute_capability` runs it. After adding the MCP, your client opens a browser so you can sign in and choose your OpenWork organization.

### Codex

```bash
codex mcp add openwork --url https://api.openworklabs.com/mcp/agent
```

### Claude Code

```bash
claude mcp add --transport http openwork https://api.openworklabs.com/mcp/agent
```

### OpenCode

Add this to `opencode.json`:

```json
{
  "mcp": {
    "openwork": {
      "type": "remote",
      "enabled": true,
      "url": "https://api.openworklabs.com/mcp/agent",
      "oauth": {}
    }
  }
}
```

### Any MCP client

Use this remote MCP server URL:

```text
https://api.openworklabs.com/mcp/agent
```

## Agent Team — Multi-Agent Orchestration

OpenWork includes a powerful multi-agent orchestration system that lets you coordinate multiple CLI agents (Claude Code, Codex, etc.) to work together on complex tasks. It is designed for teams that need to run multiple coding agents in parallel while preventing conflicts and ensuring efficient resource usage.

### Four Orchestration Modes

- **Dispatch** — Route a single task to the best agent based on policy (round-robin, capability-match, primary-with-fallback, LLM-supervisor)
- **Relay** — Serial pipeline: Agent A's output becomes Agent B's input (chain strategy)
- **Broadcast** — Send the same task to all agents in parallel, collect all results
- **Fan-out** — Each agent handles a different subtask assignment, running in parallel

### Key Capabilities

- **Worktree Isolation** — Each agent gets an independent Git worktree, preventing file conflicts when multiple agents modify the same repository simultaneously. Built-in merge support with three strategies (auto-merge, cherry-pick, sequential) and conflict detection.
- **LLM Supervisor** — An LLM-driven task router that dynamically decomposes complex tasks into subtasks and selects the best agent for each based on capabilities and context.
- **Agent Message Bus** — Direct inter-agent communication with direct, broadcast, and system message types. Enables collaboration patterns like "reviewer approves coder's changes".
- **Cost-Efficiency Model Routing** — Automatically recommends optimal models for each agent role (primary, specialist, reviewer, fallback) based on cost and capability analysis.
- **Process Pool Management** — Built-in `SidecarProcessPool` manages agent process reuse, concurrency control, and automatic cleanup to prevent resource leaks.
- **Plan-Act Pattern** — Paired execution where a "plan" phase (strong reasoner) produces a step-by-step plan, then an "act" phase (fast executor) carries it out.
- **Cloud Context** — Session snapshot store for cross-machine relay, allowing relay pipelines to resume on different machines via JSONL transcripts.

### Quick Example

```typescript
import { createAdapterForAgent } from "./agent-sidecar/index.js";
import { createAgentTeam, dispatchTask, relayPipeline, broadcastTask, fanOutTask } from "./agent-team/index.js";

// Create a team with worktree isolation
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

// Fan-out: parallel subtasks
for await (const ev of fanOutTask(team, {
  fanOutId: "feat-1",
  assignments: [
    { agentId: "claude-code", prompt: "Implement feature A" },
    { agentId: "codex", prompt: "Write tests for feature A" },
  ],
})) {
  console.log(ev);
}

// Merge all worktree changes back
const result = team.mergeWorktrees({
  strategy: "auto-merge",
  cleanupAfterMerge: true,
});

await team.stop();
```

### Dispatch Policies

| Policy | Description |
|--------|-------------|
| `round-robin` | Rotates through members sequentially |
| `first-available` | Picks the first alive agent |
| `capability-match` | Selects agent matching required capabilities |
| `primary-with-fallback` | Uses primary agent, falls back on failure |
| `role-based` | Routes by member role (primary, reviewer, specialist) |
| `llm-supervisor` | LLM-driven intelligent routing |

### Agent Roles

- `primary` — Default agent that handles most tasks
- `reviewer` — Review, proofread, and quality check
- `specialist` — Domain expert for capability-matched tasks
- `fallback` — Standby agent when primary fails
- `observer` — Read-only participant in broadcast mode

### Worktree Merge Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| `auto-merge` | Direct `git merge --no-ff` | Agents modify different files |
| `cherry-pick` | Individual commit cherry-pick | Preserving commit history |
| `sequential` | Squash commit then merge | Multiple agents modifying same files |

## OpenWork Den

OpenWork Den is the control plane for managing OpenWork across a team or organization.

- Provision inference at scale and control which members and teams can use each model provider.
- Invite teammates, create teams, and manage access from one place.
- Set desktop policies, restrict local model access, and control which app versions your organization can use.
- Publish skills and plugins through marketplaces, then assign them to the organization, a team, or specific people.
- Import Anthropic-compatible plugins and make their supported skills and remote MCPs available through the OpenWork MCP.

<img width="1546" height="915" alt="OpenWork Den organization control plane" src="https://github.com/user-attachments/assets/033dbbfe-5661-4f7c-869c-46278406d6cc" />

## Documentation

[Read the OpenWork docs.](https://openworklabs.com/docs)

## Local development

For one checkout, keep using `pnpm dev`; with no extra environment variables it reuses the existing shared dev profile.

To run multiple git worktrees at once, use:

```bash
pnpm dev:worktree
```

That sets `OPENWORK_DEV_PROFILE=auto`, derives a stable profile name from the worktree path, lets Electron choose a free CDP port, and asks Vite for a free dev-server port. You can also choose a named profile, for example `OPENWORK_DEV_PROFILE=my-feature OPENWORK_ELECTRON_REMOTE_DEBUG_PORT=0 PORT=0 pnpm dev`.

`dev:worktree` also defaults `OPENWORK_ELECTRON_USE_MOCK_KEYCHAIN=1`. A brand-new profile has no stored credentials, so on macOS the real keychain prompts as soon as Chromium persists an authenticated cookie, and that modal blocks Electron's main loop until it is dismissed. Set `OPENWORK_ELECTRON_USE_MOCK_KEYCHAIN=0` if you specifically want the system keychain in an isolated profile.

Dev startup prints a banner like `[openwork] dev profile=... cdp=http://127.0.0.1:9223`; use it to find the profile directory and pass the CDP URL to local tooling.

If a second instance cannot get the profile lock it now says so and exits, instead of lingering with an open CDP port and no window.

### Headless web (no Electron)

To run the OpenWork UI in a browser against a local `openwork-server` (no desktop shell):

```bash
pnpm dev:headless-web
```

This is an isolated launcher:

- Writes `tmp/headless-server.json` and never reads `~/.config/openwork/server.json`
- Authorizes the chosen workspace root automatically, and merges (never rewrites) that config on relaunch, so workspaces you add through the UI survive `--replace`
- Starts Vite + `openwork-server` with a stable owner bearer forced into the UI. Crash-restarts reuse that bearer so open tabs keep working; `--replace` mints fresh tokens (pass `--keep-tokens` to preserve them). The privileged host token stays on the server process and is never inlined into the Vite bundle.
- Proxies Den Cloud calls same-origin: Vite serves `/api/den` (forwarded to the Den control plane) and the app pins its Den API there via `VITE_DEN_API_BASE_URL`, so Cloud calls are never CORS-blocked and stale `localStorage` base URLs are cleared on load
- Publishes agent-facing URLs/tokens at `tmp/dev-headless-web.json` (owner-only, `0600`), and allows browser calls to the local server only from the web app's own origins — not every site you visit
- Uses stable ports by default (web `5178`, server `8778`; falls back to free ports when taken, override with `OPENWORK_WEB_PORT` / `OPENWORK_PORT`)
- Is single-instance per worktree: re-running it reuses a healthy instance and prints its URL; stale instances are cleaned up automatically; `--replace` forces a restart
- Detaches the servers from the launching terminal, so they survive the terminal closing
- Supports `--detach` to run the whole stack independent of the invoking shell (recommended for agents): it starts detached, waits for health, prints the URLs, and exits

Open the printed Web URL. Cloud sign-in in headless web uses the **copy/paste** handoff (hosted Den cannot redirect session grants back to `http://127.0.0.1`):

1. Account → Sign in (opens Den; the paste field opens in Settings)
2. Sign in on Den
3. Copy the OpenWork link / one-time code Den shows
4. Paste it under **Paste sign-in code** → Finish sign-in

Point Den at a local stack with `OPENWORK_DEV_DEN_PROXY_TARGET=http://127.0.0.1:3005` while `pnpm dev:web-local` is running. Set `OPENWORK_DEV_HEADLESS_WEB_DEN_PROXY=0` to disable the Den wiring.
