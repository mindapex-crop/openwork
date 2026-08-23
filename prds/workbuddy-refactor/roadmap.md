# OpenWork 对标 WorkBuddy/CatPaw 重构路线图

状态：方案已与用户对齐（2026-08-23）。本文档为总纲，各阶段动手前须按 `voiceover` 技能逐特性产出演示脚本并获批；代码证明走 `evals/specs` testkit。

## 已确认的决策

1. **命名基准（双语）**：中文 助理/专家/技能/连接器/资料库/自动化/项目/灵感；英文 Assistant/Experts/Skills/Connectors/Library/Automations/Projects/Inspiration。相同能力必须取名一致；OpenWork 独有能力可保留（如终端、任意 Provider）。
2. **多语言 + 多语音都要**：界面国际化补齐（10 语已有框架、覆盖率约 50%）；语音输入/对话/TTS 完整化。
3. **范围**：全面重构（桌面 + server + ee/Den + 移动端）。
4. **计费**：参考 WorkBuddy 引入 Credits 体系，同时保留用户自带 API key（双轨：自有 key 计费用量可视化，组织走 Credits 配额）。
5. **工作模式**：日常办公/代码开发/设计创意三模式，首启引导选择、设置可切换；日常办公默认隐藏开发者元素。
6. **技能生态**：兼容 OpenClaw 技能格式（导入/导出），自有格式并存。
7. **资料库**：不接腾讯文档/ima；做 文件+知识+记忆 三合一统一容器。
8. **移动端**：React Native，界面完全对标 WorkBuddy 移动版。
9. **云上环境必须支持；特殊卖点：云上/云下项目与上下文同步接力（Relay Sync）**。
10. **IM 远程控制**：企微/飞书/钉钉/Slack 四通道全接（ChatChannelAdapter 已有抽象，slack-style spec 已存在）。
11. **评测体系重新构建**：四层金字塔（见下）。

## 阶段路线

### 阶段一：概念统一与信息架构（脚本已批准，开工中）
八大模块侧边栏；connections/MCP/extensions/plugins 归一为"连接器"；协作并入项目；知识库并入资料库（文件/知识/记忆三分组，本阶段文件分组+空态）；首启三模式引导；专家/灵感占位页；marketplace/onboarding 硬编码文案 i18n 化；语言切换即时生效。
- PR 1：侧边栏 IA + 命名 + i18n key 重构（spec: `sidebar-ia-v2`）
- PR 2：连接器归一（settings 四页合一）
- PR 3：资料库容器骨架 + 首启模式引导

### 阶段二：专家/专家团 + 灵感 + 市场
引擎侧缺口（基于代码调研）：缺专家抽象层（system prompt/方法论/技能包绑定，建于 AgentTeamMember 之上）；团队持久化（现 routes/teams.ts 内存 Map）；依赖图调度执行（Supervisor 已拆解未排程）；综合者角色（fan-out 汇总）；专家编辑/团队组建 UI；与 skills 域打通。UI 侧：专家/专家团页面、市场做实、灵感（Prompt+Skill+专家配置组合包，"做同款"）。

### 阶段三：交付能力 + 语音 + Credits + OpenClaw 兼容
docx/pptx/xlsx/pdf 生成技能（对话到交付）；voice-panel 扩展为完整语音；Credits 双轨计费（Den 侧）；OpenClaw 技能格式兼容层。

### 阶段四：移动端 + 云上 + Relay Sync + IM
React Native 移动端（对标 WorkBuddy 移动版，复用阶段一命名/IA）；云上环境；Relay Sync（复用 headless-threads transcript 协议 + 远程工作区；注意与 chat-relay.ts 的 agent 接力区分命名：产品概念叫"接力同步"）；IM 四通道 adapter；离线快照与续传。

## 评测体系（四层金字塔）

- **L1 规格层**：现有 testkit 模式沿用；每阶段新 spec 强制覆盖批准脚本全帧；新增 RN driver（建议 Maestro）。
- **L2 质量层（全新）**：`evals/quality/` golden set + 混合判定（结构化输出确定性判定；开放输出 LLM judge 带 rubric+seed）。首批域：专家编排、文档产物、语音转写、i18n 完整性（纯脚本扫描，无需 LLM）。
- **L3 一致性层**：Relay Sync 专项——断网/云端接力/双端并发写/冲突合并故障注入（扩展 testkit faults）。
- **L4 冒烟层**：每日端到端用户旅程巡检（新建任务→云端接力→IM 下发→产物落库）。
- 落地顺序：L1 扩展随阶段一 PR；L2 骨架独立 PR 先行；L3/L4 随阶段四。

## 关键代码索引（调研结论）

- Agent 定义（无 system prompt 字段，CLI sidecar）：`apps/server/src/agent-sidecar/presets.ts`、`types.ts`
- 团队编排三拓扑 + Supervisor 队长：`apps/server/src/agent-team/{types,team,relay,dispatch,supervisor,team-strategies,worktree-manager,agent-runner}.ts`
- 群聊 @mention 接力（复用引擎）：`apps/server/src/chat/chat-relay.ts`
- 团队 API（内存 Map，无持久化）：`apps/server/src/routes/teams.ts`
- 前端 Team 面板：`apps/app/src/react-app/domains/session/team/`；Collab Hub（走 Den，割裂）：`domains/collab/`
- 同步基建：`packages/headless-threads/`；云认证/组织：`domains/cloud/`
- i18n（10 语，覆盖约半）：`apps/app/src/i18n/`
- 评测体系：`evals/`（testkit + 9 包，77 spec，CI PR lane 已跑）
