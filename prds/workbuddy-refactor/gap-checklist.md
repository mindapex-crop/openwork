# WorkBuddy 完全复刻 · 差距清单与逐项校验

> 依据：WorkBuddy 官方文档（新建任务栏/右侧边栏/工作模式/系统设置）+ 实机调研。
> 状态图例：`[x]` 已实现并校验 / `[~]` 部分实现 / `[ ]` 缺失待实现。
> 校验方法：typecheck → 单测 → Electron 实机（CDP DOM 快照）逐项核对。

## A. 三栏布局 & 侧边栏（IA）

| 项 | WorkBuddy 原样 | OpenWork 现状 | 状态 |
|---|---|---|---|
| A1 | 左侧栏 = 导航中枢（新建任务/助理/项目/专家/自动化），下方任务列表按文件夹分组，底部头像+设置 | 已有：新建任务/搜索/助理/专家/技能/连接器/资料库/项目/灵感 + 通知；任务按工作空间分组 | [x] |
| A2 | 自动化入口常驻侧边栏 | 桌面运行时常驻（`automationsNavigationAvailable = automationsEnabled`），未登录时页面展示登录引导；Den 探测仅驱动关注点提示 | [x] |
| A3 | 语言默认中文（微信登录中国用户） | 默认语言跟随系统（`initLocale` 探测 `navigator.language`，`zh-*→zh`） | [x] |
| A4 | 任务列表双击重命名、右键删除 | 已有：hover 操作 + 右键菜单 | [x] |

## B. 底部任务栏 / 输入区（新建任务栏）

| 项 | WorkBuddy 原样 | OpenWork 现状 | 状态 |
|---|---|---|---|
| B1 | 工作模式切换 问一问/做一做/想一想 | 已有 Ask/Craft/Plan 分段控件（hero + composer） | [x] |
| B2 | 切换模型 | 已有 ModelSelect | [x] |
| B3 | 设置工作空间（显示当前目录，可更换） | composer 工作空间选择器（显示当前工作空间 + 切换 + 新建） | [x] |
| B4 | 选择技能 | plug 菜单 → skills（含 OpenClaw 兼容） | [x] |
| B5 | 连接第三方应用 | plug 菜单 → Library（连接器） | [x] |
| B6 | 权限管理（默认权限/完全访问） | composer 权限开关（默认权限/完全访问），完全访问时权限请求自动以 "always" 应答 | [x] |
| B7 | 附文件（+ 上传/拖拽） | 已有 paperclip + 拖拽 + 粘贴 | [x] |
| B8 | 停止/重新生成 | 已有 Stop/Send(steer)/Queue | [x] |

## C. 右侧结果区（右侧边栏四区）

| 项 | WorkBuddy 原样 | OpenWork 现状 | 状态 |
|---|---|---|---|
| C1 | 产物（查看当前对话新生成文件） | 已有 Artifacts 面板 | [x] |
| C2 | 工作空间文件（树状浏览当前工作目录） | 已有 WorkspaceFilesPanel（listWorkspaceCatalog） | [x] |
| C3 | 变更（记录并对比修改，差异对比） | ChangesPanel（deriveFileChanges）已实机可用；修复：浏览器同步不再丢弃固定 tab + `useShallow` 消除 selector 无限循环崩溃；差异对比预览仍待补 | [~] |
| C4 | 浏览器（内置预览网页） | 已有 Browser 面板 | [x] |
| C5 | 未产生对话时右侧结果区不可展开 | 已实现：无对话/空会话时 工作空间文件/变更/产物 rail 按钮禁用（含提示），已展开则收起；有对话时启用 | [x] |

## D. 工作模式语义

| 项 | WorkBuddy 原样 | OpenWork 现状 | 状态 |
|---|---|---|---|
| D1 | Ask 只问答不修改文件（不耗积分） | frameTaskPrompt ask 追加只读框定（read-only、不修改文件）；hero 与会话 composer 显示只读提示 | [x] |
| D2 | Plan 先出计划、确认后执行 | frameTaskPrompt plan=先计划等确认 | [x] |
| D3 | Craft 直接执行并改文件 | frameTaskPrompt craft=最小改动提示 | [x] |
| D4 | 模式影响模型/行为 | resolveTaskModeVariant（craft→balanced/plan→reasoning） | [x] |

## E. 设置

| 项 | WorkBuddy 原样 | OpenWork 现状 | 状态 |
|---|---|---|---|
| E1 | 个人偏好（岗位/场景/输出偏好/语言风格） | preferences-view 已有 | [x] |
| E2 | 记忆（生成对话记忆开关） | memory-view 已有 | [x] |
| E3 | 系统-锁屏远程 | 需核对（远程访问设置） | [~] |
| E4 | 主题切换（浅色/深色） | appearance-view 已有 | [x] |
| E5 | 快捷指令 | commands 已有 | [x] |
| E6 | 连接管理（公众号/IMA 等） | connectors-view 已有 | [x] |

## F. 快捷键与交互

| 项 | WorkBuddy 原样 | OpenWork 现状 | 状态 |
|---|---|---|---|
| F1 | Enter 发送 / Shift+Enter 换行 | 已有 | [x] |
| F2 | Ctrl+K 新建对话 | 待核（command palette Ctrl+P?） | [~] |
| F3 | 会话内"重新生成" | 消息操作有 Branch/Revert/Edit | [~] |

## G. 积分/计费

| 项 | WorkBuddy 原样 | OpenWork 现状 | 状态 |
|---|---|---|---|
| G1 | 积分体系（体验版 500/月；标准 99 元 4000 分；高级 199 元 9000 分；旗舰 999 元 50000 分；模型倍率 x0.xx；加量包；用量查看） | 无积分；有 OpenWork Models 订阅入口 | [~] |

## H. 功能详解模块复刻（依据官方 Task-Bar/Setting/Memory/Assistant/Project/Expert/Automation/Library 等页）

| 项 | WorkBuddy 原样 | OpenWork 现状 | 状态 |
|---|---|---|---|
| H1 | 输入区含连接器快捷管理入口（连接第三方应用） | plug 菜单 → Library 可达；输入区无独立快捷入口 | [~] |
| H2 | 权限确认弹窗三要素（操作内容/影响范围/执行理由）+ 完全访问二次确认勾选 | 权限面板有 scopeLabel/scopeValue（影响范围）；「操作内容/理由」与完全访问二次确认待核 | [~] |
| H3 | 任务状态筛选面板（按状态/日期 + 重置）+ 6 态文案（进行中/已完成/失败/待处理/规划中/已归档） | 无筛选面板；状态枚举待核 | [ ] |
| H4 | 对话区顶部 4 操作：对话内搜索 / 任务分享（公开链接）/ 历史提问 / 显示详情面板 | 有历史导航（conversation-tab-history）与工作空间分享；任务分享、对话内搜索、详情面板入口待核 | [~] |
| H5 | 显示模式设置：简洁模式（折叠工具调用过程信息）/ 非高风险自动安装 / 防休眠（远程操控与自动化） | 无 | [ ] |
| H6 | 记忆增强：每晚更新摘要展示 + 对话式编辑（告诉记住/忘记）+ 从其他 AI 导入 | memory-view 有生成开关；对话式编辑/导入待核 | [~] |
| H7 | 助理（远程 IM 接入：微信/企微/QQ/飞书/钉钉）卡片式设置页 + 绑定中/已绑定状态 | 无远程 IM 助理 | [ ] |
| H8 | 项目增强：模板创建 / 资产 5GB 容量显示 / 邀请成员审批 / 任务流转（打包产物+摘要+自定义字段） | Projects 页面已有；模板/容量/审批/流转待核 | [~] |
| H9 | 自动化增强：对话式创建 / 任务模板（新闻推送/周报/体检预约/学习计划）/ 推送到小程序 | Automations 页面已有；对话创建/模板/推送待核 | [~] |
| H10 | 资料库增强：我的文档/团队空间分区 / 目录树 / MD/CSV/HTML 三载体联动 / 发布为网站（workbuddy.link）/ 划词评论与修订 | Library 页面已有；分区/三载体/发布/协作待核 | [~] |
| H11 | 连接器管理页：服务卡片 + 连接状态绿点 + 启用/禁用开关 + 解绑弹窗 | connectors-view 已有；卡片形态待核 | [~] |
| H12 | 灵感：精选/场景分类/搜索 + 收藏（红心）+ 做同款（预填 Prompt+加载 Skill/专家） | Inspiration 页面已有；收藏/做同款待核 | [~] |
| H13 | 我的邮箱（Agent 邮箱 `xxx.agent@agent.qq.com`）：收信/发信列表 + 对话内邮件引用卡片预填充 | 无 | [ ] |
| H14 | 专家/专家团：卡片网格 + 团长自动拆解/并行执行/整合交付 | Experts 页面已有；专家团待核 | [~] |
| H15 | 设计创意（Ardot 画布集成：对话生成设计稿/框选修改/生成应用） | 无 | [ ] |
| H16 | 轻量发布：产物「分享→发布为网站」生成 workbuddy.link 链接 | 待核（Library 发布能力） | [~] |
| H17 | 人机双写：右侧文件预览区划词「AI 编辑」工具栏（润色/排版/生成） | 无 | [ ] |

## 实施批次

- **批次 A**（高可见差距，已全部完成并实机校验）：A3 默认语言跟随系统；B3 工作空间选择器；B6 权限模式切换（含完全访问自动应答）
- **批次 B**（已完成并实机校验）：A2 自动化入口常驻侧边栏（桌面运行时，未登录展示登录引导）；D1 Ask 只读（frameTaskPrompt 只读框定 + hero/composer 提示）；C5 无对话时右侧结果区不可展开
- **批次 B 附带修复**：ChangesPanel selector 无限循环崩溃（`useShallow`）；浏览器同步丢弃固定面板 tab（工作空间文件/变更在 Electron 下无法稳定打开）
- **批次 C**：逐一校验（typecheck + 单测 + Electron DOM 快照）并修复 —— 见各状态列
- **批次 D（依据 H 区）**：H3 任务状态筛选、H4 对话区顶部操作、H5 显示模式（简洁/防休眠）、H2 权限弹窗三要素 → 再 H13/H17/H15 大模块
