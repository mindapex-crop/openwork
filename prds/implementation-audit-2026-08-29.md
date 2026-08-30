# OpenWork 实现审查报告：与 PRD 的差异 + 无效 Mock 数据排查

日期：2026-08-29 · 分支：feature/codex-advanced-features-local

## 0. 审查范围与方法

**依据文档（预期基线）：**
- `prds/workbuddy-refactor/roadmap.md`（11 项决策 / 4 阶段）
- `prds/workbuddy-refactor/gap-checklist.md`（A–H 逐项状态）
- `prds/workbuddy-refactor/workbuddy-deep-analysis.md`、`workbuddy-module-mapping.md`、`screenshot-module-replication.md`
- `docs/superpowers/plans/2026-08-20-codex-advanced-features.md`（goal / loop / dynamic / site）

**方法：** 对每个可疑特性追踪数据流 `UI 组件 → store → server route → 持久化`，把结论分为 6 类：
真实实现 / 静态目录 / 伪造指标 / 浅实现 / 已实现未接线 / 缺失。仅记录有 `file:line` 证据的结论。

---

## 1. 结论摘要（TL;DR）

| 类别 | 数量 | 严重度 | 说明 |
|---|---|---|---|
| **伪造用户可见指标（mock）** | 4 | P0 | 假使用量、假存储、假积分 |
| **浅实现 / 死代码** | 3 | P0–P1 | 假交互、无服务端协同、未接线的 goal/loop |
| **i18n 硬编码绕过** | 2 | P1 | 中文/英文串直写 |
| **静态目录（可接受但有限）** | 5 | P2 | 内置清单，未「把市场做实」 |
| **真实实现（复核可信）** | 9 | — | Experts / 团队执行 / 连接器 / 资料库 / Relay 等 |

**总体判断：** 底层能力（专家 CRUD、团队编排、连接器、资料库、Relay Sync、工作模式）是**真实**的；问题集中在**WorkBuddy 视觉复刻时叠加的"营销型数字"和部分"名字有了、逻辑是假的"的浅实现**。这些正是 gap-checklist 里标 `[~]` 却未逐条落地的部分。

---

## 2. 无效 / 伪造 Mock 数据清单（重点）

### 2.1 专家「使用次数」全平台写死 `1,828,300` — P0
- `experts/experts-page.tsx:820` 和 `:839`：`usageCount={1828300}`
- `experts/expert-card.tsx:33`：`usageCount = 1828300`（默认）
- `experts/expert-detail-modal.tsx:24`：同上
- 表现：每张专家卡与详情弹窗都显示 **"182.83万次使用"**（`expert-card.tsx:27`），数字直接抄自 WorkBuddy 截图。
- 证据：`server/src/experts/types.ts`、`expert-store.ts` 的 Expert 模型**没有 usage 字段**，后端不可能返回它。
- 影响：用户误以为存在真实使用热度排序依据。task #12 标注为"dynamic usage count"实为固定值。
- 修复：删除该展示，或在 Expert 模型加真实 `installCount/runCount` 并在 `/teams/run-simple` 调用时累加。

### 2.2 灵感「做同款次数」由标签数算出的伪随机数 — P0
- `inspiration/inspiration-page.tsx:303`：`const usageCount = (pack.skills.length * 128 + pack.tags.length * 47) % 900 + 100;`
- `:345` 渲染为「N 做同款」。数字与真实使用完全无关，仅随包内标签数量变化。
- 修复：移除或接入真实计数。

### 2.3 项目「存储容量 4.4GB/5GB」进度条 = 任务数×0.12 — P0
- `projects/project-detail-panel.tsx:1457`：`const usedGB = (totalTasks * 0.12).toFixed(1);`
- `:1458` `capacityPercent = usedGB/5*100`，`:1475-1482` 渲染颜色分段的容量条与 `X.XGB / 总容量`。
- 表现：完全对应 PRD H8「资产 5GB 容量显示」，但**用任务数量伪造字节占用**，不看任何真实文件。
- 修复：改为统计项目工作目录真实字节（资料库文件列表已具备数据源，见 2.x 资料库真实读目录）。

### 2.4 账户菜单「积分 2,580 / 成长计划 Pro / 升级」全假 + 死按钮 + 未 i18n — P0
- `session/sidebar/account-status-menu.tsx:419-436`：
  - `:424` 直写 `积分 · 2,580`
  - `:425` 直写 `成长计划 Pro`
  - `:428-434` `升级` 按钮是 `<button type="button">`，**没有 `onClick`**，点击无任何行为。
  - 三处中文**绕过 `t()`**（见 §6）。
- 证据：项目**没有积分/Credits 系统**（roadmap 决策#4、gap-checklist G1 均为 `[~]`，仅有 OpenWork Models 订阅入口）。
- 修复：整块删除或替换为真实订阅/用量入口（`credits-section.tsx`）。

---

## 3. 浅实现 / 名字有了逻辑是假的

### 3.1 「从模板创建项目」只改名字，不实例化模板 — P1
- `projects/projects-page.tsx:59` `PROJECT_TEMPLATES` 为静态清单。
- `:165-179` `handleTemplateSelect` 仅把项目命名为 `` `My ${templateName} Project` `` 并写一句 `` `Created from ${templateName} template` ``，**不绑定模板描述的技能/专家/结构**。
- PRD H8「模板创建」名不副实；且模板名为硬编码英文（见 §6）。

### 3.2 「多人协同/团队空间」是纯本地，无服务端共享 — P1
- `projects/project-store.ts:610`：`createJSONStorage(() => localStorage)` —— 项目、任务、成员、邀请（`InviteRecord` `project-detail-panel.tsx:112-117`）、审批、动态（`addActivityEvent`）**全部只存浏览器本地**。
- 成员/邀请/审批 UI 存在，但没有服务端共享模型，跨设备/跨成员不可见。
- 与 PRD 决策#3（含 ee/Den）、H8「邀请成员审批」、roadmap「协作并入项目」的**真实团队**目标存在架构级差距。

### 3.3 Codex「goal / loop」已写 + 已测，但未接线（孤儿模块）— P1
- `apps/server/src/agent-sidecar/goal.ts`（`parseGoal`/`validateGoalResult`）与 `packages/automations/src/loop.ts`（`runLoop`）**各自有单测**（`goal.test.ts`、`loop.test.ts`）。
- 但全仓库**无任何生产调用方**引入它们（route / engine 均未接入）。
- `docs/superpowers/plans/2026-08-20-codex-advanced-features.md` 21 项 `- [ ]` 全未勾选（0/21）。
- 结论：概念验证级，**不在产品路径上**；不可当作已交付。

---

## 4. 静态目录（作为种子内容可接受，但「市场做实」目标未达成）

| 清单 | 位置 | 条数 | 备注 |
|---|---|---|---|
| `SKILL_CATALOG` | `skills/skill-catalog.ts:33` | 固定 | 内置技能目录，非在线市场 |
| `INSPIRATION_PACKS` | `inspiration/inspiration-store.ts:13` | **仅 6** | 文件自述「不依赖后端」；做同款→真实建专家（好） |
| `AUTOMATION_TEMPLATES` | `automations/automation-templates.ts:14` | 固定 | 一键套模板→真建自动化 |
| `EXPERT_CATEGORIES` | `experts/expert-taxonomy.ts:4` | 固定 | 分类枚举，合理 |
| `PROJECT_TEMPLATES` | `projects/projects-page.tsx:59` | 固定 | 见 §3.1 浅实现 |

roadmap 阶段二要求「市场做实」——目前仍是内置清单，非真实 marketplace 后端。

---

## 5. 复核确认：以下实现是真实的（无需返工）

- **专家 CRUD**：`/api/experts` → `ExpertStore` 文件持久化（`.md` + YAML frontmatter，`expert-store.ts:72-157`）。
- **专家团执行**：`expert-group-runner.ts` 真实 `POST /teams/run-simple`（复用 agent-team 内核）。
- **团队持久化**：`routes/teams.ts:39` 引入 `TeamStore` 文件存储 —— **修正 roadmap「现 routes/teams.ts 内存 Map」的旧述**。
- **连接器状态**：`marketplace-page.tsx` 由 `useOrgMcpConnections` 派生真实 `connected/needs_reconnect/available`（`:80-133`），非绿点装饰。
- **资料库文件**：`knowledge/library-page.tsx` 真实读取工作空间目录列表。
- **Relay Sync（接力同步）**：前端 `relay/relay-store.ts` 轮询 + `POST /api/relay-sync/:threadId/relay`，后端 `routes/relay-sync.ts`（含 `relay-sync.test.ts`）—— 决策#9 卖点为真实实现。
- **工作模式 Ask/Plan/Craft**：`frameTaskPrompt` 真实框定（D1–D4）。
- **知识库条目**：`knowledge-store.ts` localStorage 持久化（本地设计，合理）。
- **移动端**：`apps/mobile/src` 为真实 RN 应用（Chat/Projects/Experts/Automations/Assistant/Settings/Pairing 等屏），但功能面小于桌面。

---

## 6. i18n 违规（硬编码绕过 `t()`）

- `account-status-menu.tsx:424,425,433`：中文「积分 / 成长计划 Pro / 升级」直写。
- `projects-page.tsx:175-176`：英文 `My ${templateName} Project` / `Created from ${templateName} template` 直写。
- 违反 roadmap 决策#1（双语命名统一）与阶段一「硬编码文案 i18n 化」。英文模板名在中文界面尤其突兀。

---

## 7. 与 PRD 的关键功能差异（gap-checklist 未落地项）

| PRD 目标 | 决策/项 | 现状 | 差距 |
|---|---|---|---|
| Credits 双轨计费 | 决策#4 / G1 | 仅假积分 + Models 订阅 | **无真实积分系统** |
| IM 四通道远程（企微/飞书/钉钉/Slack） | 决策#10 / H7 | 连接器走提示词框定（见 auto-memory），无真实后端 agent/回调 | 远程执行链路未闭环 |
| 资料库三合一（文件+知识+记忆） | 决策#7 / H10 | 文件真实、知识本地、记忆部分 | 三载体联动/团队空间未成 |
| 项目模板创建 / 审批 / 流转 | H8 | 见 §3.1/§3.2 | 浅实现，无服务端 |
| Codex goal/loop | plan 21 项 | 见 §3.3 | 0/21 接线 |
| 专家/灵感「市场做实」 | 阶段二 | 静态目录 | 未做真后端 |

---

## 8. 优先级建议

**P0（误导用户 / 死交互，建议尽快删或接真数据）**
1. 专家假 `1828300` 使用次数（§2.1）
2. 灵感伪随机使用次数（§2.2）
3. 项目假 `X.XGB/5GB` 容量条（§2.3）
4. 账户假「积分/成长计划/升级」死按钮（§2.4）

**P1（名不副实 / 未接线）**
5. 「从模板创建」真正实例化模板（§3.1）
6. i18n 硬编码清理（§6）
7. goal/loop 接线或明确标注为实验、移出用户可见面（§3.3）

**P1–P2（架构缺口，按阶段规划）**
8. 多人协同服务端化（§3.2）
9. Credits / IM 远程闭环（§7）

---

## 9. 本次未验证 / 需人工确认（诚实声明）

- **Automations 真实调度**：代码走 `packages/automations` + Den，文案称「Den 保存调度与历史」，但**本环境未连 Den 实跑**（需登录，headless 亦无可用模型）。
- **权限「完全访问」自动应答 / 二次确认**（H2）：未逐一验证弹窗三要素落地。
- **视觉走查证据**：headless 模式下 OpenWork 内嵌浏览器视口 `visibilityState=hidden`，`take_screenshot` 失败（前序已知），本报告结论基于**源码数据流追踪**而非截图。
- 部分 `placeholder/mock` 关键字命中（219 处/90 文件）为合法 UI 占位符与 ID 生成，未计入伪造数据。
