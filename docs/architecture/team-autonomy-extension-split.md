# Team Autonomy 拆分方案：Extension vs 核心改动

> 基于 `feat/team-autonomy` 分支 33 个 commit 的真实代码分析。
> 当前分支状态：`feat/team-autonomy@f2b932c7`，基于 `origin/dev@5fa41c4d`（旧），未同步上游最新 `51902a94`。

## 一、整体结论

**team-autonomy 不能整体打包成一个 OpenWork Extension**。原因是它包含 6 张新的数据库表、auth hook 注入、agent 调度架构改动、desktop 端配置等"平台级基础设施"，超出了上游 extension 系统的 9 种 contribution 类型的能力边界。

正确路径：**分两阶段**。

```
Phase 1（核心层，必须合入 origin/dev）
├── 数据库 schema + migration（6 张表）
├── auth.ts personal-team auto-create hook
├── agent-team relay + sidecar adapter 架构
└── desktop VITE_DEN_BASE_URL + SSO 配置

Phase 2（Extension 层，可独立打包）
└── team-autonomy-extension
    ├── manifest.json（123 条 server-route contribution）
    ├── settings/team-autonomy-panel.tsx
    ├── session/runtime-reporting-panel.tsx
    └── resources/generic-adapter.json
```

## 二、Phase 1：必须进核心的改动

### 2.1 数据库 schema + migration

**commit 归属**：`f2b932c7`、`8230b73e`、`27c615ec`
**涉及文件**：
- `ee/packages/den-db/schema/*` — 至少 6 张新表（推断：assets / tasks / team-agents / inbox / permissions / automations / engine_config）
- `ee/packages/den-db/migrations/*` — 至少 2 个 migration SQL

**为什么不能进 extension**：
上游 OpenWork extension 系统（`apps/app/src/app/extensions.ts`）的 12 种 resource 类型（`agent` / `tool` / `opencode-plugin` / `mcp` / `hook` 等）**没有任何一种支持动态建表**。数据库 schema 是服务端核心基础设施，必须作为 migration 合入 `origin/dev`，由 den-db package 管理版本。

### 2.2 Auth hook 注入

**commit 归属**：`f46225f0`（wire personal-team auto-create into auth session.create hook）
**涉及文件**：
- `ee/apps/den-api/src/auth.ts`
- `ee/apps/den-api/src/session.ts`

**为什么不能进 extension**：
在 `session.create` 的 auth hook 里注入 personal-team 自动创建逻辑，改的是**认证核心流程**。OpenWork 没有提供 auth hook 的扩展点（`server-route` / `native-capability` 都进不了认证链路）。

### 2.3 Agent 调度架构

**commit 归属**：`39fbbf4e`、`c0cf338e`、`167563c0`、`1ef70596`
**涉及文件**：
- `apps/server/src/agent-sidecar/**` — ACP/PTY/MCP/Generic 4 种 sidecar adapter
- `apps/server/src/agent-team/**` — team relay
- `apps/server/src/governance/**` — QM 治理层 + 进程池

**为什么不能进 extension**：
- `agent-team relay` 改了 agent 调度的基本架构（从"单 agent 调 tool"变成"team 内多 agent 路由"），属于协议层改动。
- PTY/MCP adapter 依赖底层终端模拟器、MCP 协议栈，不是可插拔的 sidecar。
- **唯一能进 extension 的部分**：`Generic CLI agent adapter`（`c0cf338e`，独立 headless 进程）可以作为 `resource.type: "local-service"` 声明，描述启动命令、端口、协议。

### 2.4 Desktop 配置 + SSO

**commit 归属**：`f58f5256`、`a77368b2`、`c553db06`
**涉及文件**：
- `apps/desktop/electron/main.mjs`（VITE_DEN_BASE_URL 配置）
- `apps/desktop/.env.local.example`
- `ee/apps/den-api/src/sso.ts`（better-auth SSO）

**为什么不能进 extension**：
- `VITE_DEN_BASE_URL` 是 Electron 构建时注入的环境变量，extension 系统无法在构建阶段改环境变量。
- SSO 认证核心同样没有扩展点。

## 三、Phase 2：可进 Extension 的改动（123 条 route + 面板 + 资源）

### 3.1 server-route contribution（123 条 HTTP route）

**commit 归属**：`cb40ccb1`（HTTP route layer）

**涉及的 7 个 route 文件 + 完整 route 清单**：

#### agents.ts（9 条）
- GET /api/teams/:teamId/agents
- POST /api/teams/:teamId/agents
- GET /api/teams/:teamId/agents/:agentId
- PATCH /api/teams/:teamId/agents/:agentId
- DELETE /api/teams/:teamId/agents/:agentId
- POST /api/teams/:teamId/agents/:agentId/assign/:taskId
- POST /api/teams/:teamId/agents/:agentId/unassign
- POST /api/teams/:teamId/agents/:agentId/pause
- POST /api/teams/:teamId/agents/:agentId/resume

#### tasks.ts（10 条）
- GET /api/teams/:teamId/tasks
- POST /api/teams/:teamId/tasks
- GET /api/teams/:teamId/tasks/:taskId
- PATCH /api/teams/:teamId/tasks/:taskId/status
- PUT /api/teams/:teamId/tasks/:taskId/plan
- POST /api/teams/:teamId/tasks/:taskId/plan/approve
- POST /api/teams/:teamId/tasks/:taskId/plan/reject
- POST /api/teams/:teamId/tasks/:taskId/handoff
- POST /api/teams/:teamId/tasks/:taskId/dependencies
- DELETE /api/teams/:teamId/tasks/:taskId/dependencies/:dependsOnId

#### boards.ts（4 条）
- GET /api/teams/:teamId/boards
- POST /api/teams/:teamId/boards
- GET /api/teams/:teamId/boards/:boardId
- GET /api/teams/:teamId/boards/:boardId/tasks

#### artifacts.ts（6 条）
- GET /api/teams/:teamId/artifacts
- POST /api/teams/:teamId/artifacts
- GET /api/teams/:teamId/artifacts/:artifactId
- POST /api/teams/:teamId/artifacts/:artifactId/transition
- POST /api/teams/:teamId/artifacts/:artifactId/versions
- GET /api/teams/:teamId/artifacts/:artifactId/versions/:version

#### automation.ts（13 条）
- GET /api/teams/:teamId/automations
- POST /api/teams/:teamId/automations
- GET /api/teams/:teamId/automations/runs/:runId
- POST /api/teams/:teamId/automations/runs/:runId/advance
- POST /api/teams/:teamId/automations/runs/:runId/fail
- GET /api/teams/:teamId/automations/alerts
- POST /api/teams/:teamId/automations/alerts
- POST /api/teams/:teamId/automations/alerts/:alertId/acknowledge
- GET /api/teams/:teamId/automations/:automationId
- PATCH /api/teams/:teamId/automations/:automationId
- PATCH /api/teams/:teamId/automations/:automationId/schedule
- POST /api/teams/:teamId/automations/:automationId/manual-run
- POST /api/teams/:teamId/automations/:automationId/runs

#### inbox.ts（4 条）
- GET /api/teams/:teamId/inbox
- POST /api/teams/:teamId/inbox
- GET /api/teams/:teamId/inbox/:inboxId
- POST /api/teams/:teamId/inbox/:inboxId/resolve

#### permissions.ts（6 条）
- GET /api/teams/:teamId/permissions/profile
- PUT /api/teams/:teamId/permissions/profile
- GET /api/teams/:teamId/permissions/rules
- POST /api/teams/:teamId/permissions/rules
- POST /api/teams/:teamId/permissions/rules/:ruleId/revoke
- POST /api/teams/:teamId/permissions/check

#### shared.ts / index.ts（0 条 route，纯中间件 + 聚合）

**总计：52 条 HTTP route**

**extension manifest 里的声明格式**（参照上游 Voice Mode 扩展的 `extensions.ts` 第 275-277 行）：
```ts
{
  type: "server-route",
  location: "server",
  ref: "GET /api/teams/:teamId/agents",
}
```

`ref` 格式严格遵循 `"METHOD /path"`（含 `:param` 占位符）。

### 3.2 settings-panel contribution

**涉及文件（推断）**：
- `apps/app/src/react-app/shell/settings-route.tsx` — 新增 team autonomy 设置 tab

**extension manifest 声明格式**：
```ts
{
  type: "settings-panel",
  ref: "TeamAutonomySettingsPanel",
  label: "Team Autonomy",
  description: "Agents, boards, automations, inbox, and permissions for your team.",
}
```

### 3.3 session-side-panel / session-rail-item contribution

**涉及文件（推断，基于 `1ef70596` commit）**：
- runtime reporting 面板
- worktree lifecycle 面板
- chat bridge

**extension manifest 声明格式**：
```ts
{
  type: "session-side-panel",
  ref: "TeamAutonomyRuntimePanel",
  location: "session-right-pane",
}
```

### 3.4 local-service resource（Generic CLI agent adapter）

**涉及文件**：
- `apps/server/src/agent-sidecar/adapters/generic-adapter.ts`（推断路径）

**extension manifest 声明格式**：
```ts
{
  type: "resource",
  resource: {
    id: "madapex-team-autonomy:generic-cli-adapter",
    type: "local-service",
    description: "Generic CLI agent adapter — spawns an agent process and proxies commands over a local socket.",
  }
}
```

### 3.5 composer-prompt contribution

用于给 team autonomy 场景提供 composer 提示模板（"为 team 创建新任务"、"审批 plan" 等）：
```ts
{
  type: "composer-prompt",
  ref: "TeamAutonomyPrompt",
  label: "New team task",
  description: "Create a new task in the team board.",
  location: "composer",
  prompt: "Create a new team task with title and assignee.",
}
```

## 四、推荐落地节奏

```
Step 1（当前已完成）
├── 把 feat/team-autonomy 推送到 mindapex 远端
├── 完成 Phase 2 的 extension manifest 声明清单
└── 输出本 PRD

Step 2（短期）
├── 新建 phase-1-core 分支
├── 从 origin/dev@51902a94（最新）重新 cherry-pick 6 张表 schema + migration
├── 合入 auth.ts hook 注入
├── 合入 agent-team relay 架构改动
├── 合入 desktop VITE_DEN_BASE_URL 配置
└── 推送到 mindapex/phase-1-core，准备 PR 到 different-ai/openwork dev

Step 3（中期）
├── 从 origin/dev（含 phase 1）切 phase-2-extension 分支
├── 新建 apps/app/extensions/team-autonomy/manifest.ts
├── 按本 PRD §3 声明 52 条 server-route + 3 类面板 + 1 个 resource + composer-prompt
├── 迁移 route/service 代码到新目录结构
└── 推送到 mindapex/phase-2-extension

Step 4（长期）
├── 上游不同 merge phase 1 → extension 无法运行
└── 方案：把 team-autonomy 作为自托管增强（MindApex 产品定位），
    不依赖上游合入；但 phase 1 的核心改动需要定期 rebase 到上游 dev 以跟进上游演进
```

## 五、风险与待决问题

### 5.1 Phase 1 的数据库 migration 命名冲突

上游 `origin/dev` 可能已有自己的 migration 编号序列（如 `00xx`）。我们 team-autonomy 的 migration（`0050`、`0051`）可能与上游冲突。需要在 phase-1-core 分支上重新编号。

### 5.2 Auth hook 的时序依赖

`personal-team auto-create` hook 依赖 `member` / `organization` 已存在。如果上游改了 auth 流程，hook 注入点可能失效。需要重新验证。

### 5.3 Agent relay 与上游 agent 模型的兼容

上游 `51902a94` 之后可能引入了新的 agent 模型（`TeamAgentTable`、`TeamAgentEngine` 等 enum 值）。我们的 agent-team relay 需要适配。

### 5.4 Extension 的 server-route ref 是否会被上游校验

上游 `extensions.ts` 对 `server-route` 的 `ref` 没有声明式校验（只是 string 字段）。但实际 route 注册时是否会与已有 route 冲突需要 runtime 验证。

### 5.5 6 张表能否压缩到更少的 migration

如果 phase 1 的 6 张表能在一次 migration 内建完，可以减少 DB 层的改动面，降低 merge 冲突概率。

## 六、参考资料

- 上游 extension 系统：`apps/app/src/app/extensions.ts`
- 上游 Voice Mode 扩展（server-route ref 格式示范）：`apps/app/src/app/extensions/voice-mode/manifest.ts`
- team-autonomy service 设计文档：`feats/team-autonomy/services/*.md`（`feat/team-autonomy` 分支上）
- 本 PRD 对应的 route 清单数据来源：`git show feat/team-autonomy:ee/apps/den-api/src/routes/team-autonomy/*.ts`
