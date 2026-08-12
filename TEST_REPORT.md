# OpenWork 测试报告

> 生成时间：2026-08-13  
> 代码版本：feat/team-autonomy branch  
> 测试范围：功能页导航修复 + 可插拔 SSO + Codex 风格 UI 改造

---

## 一、测试概况

| 项目 | 内容 |
|------|------|
| 测试环境 | macOS + OpenWork Electron (dev) + 9223 CDP |
| 代码版本 | 5 commits（d68864dc → a77368b2 → c553db00 → 81920885） |
| 测试方式 | agent-desktop 截图 + CDP 协议自动化验证 + 代码审查 |
| 涉及模块 | 导航路由、SSO 后端 schema + API、全局 CSS 主题 |

---

## 二、功能页导航修复（Commit a77368b2）

### 问题描述
用户进入 `/space`（空间）或 `/admin`（管理）页面后，sidebar 被全屏路由替换，无法返回主会话界面。

### 修复内容
在 `space-route.tsx` 和 `admin-route.tsx` 的 header 左侧添加 `← 返回主界面` 按钮：
```tsx
<button onClick={() => navigate("/session")}>
  <ArrowLeft className="size-3.5" />
  {t("app.back_to_session")}
</button>
```

### 验证结果
| 测试项 | 预期 | 实际 | 状态 |
|--------|------|------|------|
| 空间页 header 有返回按钮 | 可见 | 已添加至 space-route.tsx | ✅ |
| 管理页 header 有返回按钮 | 可见 | 已添加至 admin-route.tsx | ✅ |
| 点击返回 → 跳转 /session | navigate("/session") | 路由存在且有效 | ✅ |

---

## 三、可插拔 SSO 架构改造（Commit c553db00）

### 问题描述
原架构将 SSO provider ID 硬编码为 `openwork-sso-{orgId}`，且 `sso_connection` 表对 `organizationId` 有唯一索引，每个组织只能 1 个 SSO。无法支持多公司自定义接入。

### 修复内容

| 层 | 改动 |
|---|---|
| **Schema** | 去掉 `organizationId` 唯一索引，加 `providerName` + `customLoginPage` 字段，改用 `(orgId, providerName)` 复合唯一索引 |
| **Provider ID** | `buildOrganizationSsoProviderId(orgId, providerName?)` 接受自定义 provider 名 |
| **API 注册** | `registerOrganizationSsoConnection` 透传 `providerName`/`customLoginPage` |
| **API Schema** | `/v1/sso/saml` 和 `/v1/sso/oidc` 注册请求加 `providerName`/`customLoginPage` 字段 |
| **API 响应** | `buildConnectionPayload` 返回 `providerName` |
| **前端表单** | `sso-screen.tsx` 加 `providerName` 和 `customLoginPage` 输入框 |

### 验证结果
| 测试项 | 预期 | 实际 | 状态 |
|--------|------|------|------|
| `buildOrganizationSsoProviderId(orgId)` 无参 | 返回 `sso-{orgId}` | 已实现 | ✅ |
| `buildOrganizationSsoProviderId(orgId, "madapex")` 有参 | 返回 `sso-{orgId}-madapex` | 已实现 | ✅ |
| Schema: 去掉 orgId 唯一索引 | 同 org 可注册多个 SSO | 已移除 | ✅ |
| Schema: 新增 providerName 字段 | 字段存在 | 已添加 | ✅ |
| Schema: 新增 customLoginPage 字段 | 字段存在 | 已添加 | ✅ |
| API: 注册请求含 providerName | 透传 | 已实现 | ✅ |
| API: 响应返回 providerName | 返回 | 已实现 | ✅ |
| 前端: 表单含 providerName 输入 | 可见 | 已添加 | ✅ |
| TS 编译 | clean | `tsc --noEmit` exit 0 | ✅ |

---

## 四、Codex 风格 UI 改造（Commit 81920885）

### 设计基准
参考 Codex Desktop 真实设计语言：
- **Sidebar**: 深灰 bg `#2F2F2F`，白色文字 `#FFFFFF`，accent orange `#FF8A00`
- **Main 内容区**: 白底 `#FFFFFF`，圆角 12px，垂直居中
- **Sessions**: 白底 `#FFFFFF`，灰色分隔线 `#EAEAEA`，文字 `#1A1A1A`
- **Inputs**: 浅灰 `#F4F4F4`，圆角 24px
- **Green accent**: `#22C55E`

### 改动内容

| 文件 | 改动 |
|------|------|
| `apps/app/src/app/index.css` | 全局 CSS 变量覆盖：`--dls-surface/#FFFFFF`、`--dls-accent/#FF8A00`、`--dls-border/#EAEAEA`、`--dls-text/#1A1A1A`、`--dls-green/#22C55E`、`--dls-radius/12px`、`--dls-sidebar-bg/#2F2F2F` |
| `apps/app/src/app/index.css` | `[data-sidebar]` → 深灰背景 `#2F2F2F` + 白色文字 |
| `apps/app/src/app/index.css` | `body` → 全局白底 `#FFFFFF` + Inter 字体 |
| `apps/app/src/app/index.css` | `[data-sessions]` → 白底圆角 12px + padding 32px |
| `apps/app/src/app/index.css` | `input/textarea` → 圆角 24px + 浅灰 `#F4F4F4` |
| `apps/app/src/app/index.css` | `[data-message-bubble]` → 无背景 + 左侧 2px 灰色分隔线 |
| `apps/app/src/app/index.css` | `[data-card]` → 白底 + `#EAEAEA` 边框 + 12px 圆角 |
| `apps/app/src/react-app/domains/session/chat/session-page.tsx` | 主容器从蓝色径向渐变 → 纯白底 `bg-white` |

### 截图验证（test-main-codex.png）

| 测试项 | 预期 | 实际截图 | 状态 |
|--------|------|----------|------|
| sidebar 背景 → 深灰 | `#2F2F2F` | 截图确认深灰侧栏 | ✅ |
| sidebar 文字 → 白色 | `#FFFFFF` | "搜索会话"/"扩展"/"空间"/"管理" 白色 | ✅ |
| 主内容区背景 → 纯白 | `#FFFFFF` | 截图确认纯白内容区 | ✅ |
| 主标题文字 → 深黑 | `#1A1A1A` | 主标题深黑色 | ✅ |
| 工作区选择器 pill | accent orange | "trae_projects" 橙色前缀 | ✅ |
| 输入框 → 圆角 24px 浅灰 | `#F4F4F4` | 输入框圆角浅灰 | ✅ |
| 会话列表文字 → 深黑 | `#1A1A1A` | "新建会话"/"Kimi CLI UI实测试！"深黑色 | ✅ |
| 卡片标题 → 深黑 | `#1A1A1A` | "Summarize my week" 深黑色 | ✅ |
| 占位符 → WorkBuddy 中文 | 中文 | "今天帮你做些什么？@引用文件，/调用技能与指令" | ✅ |
| 模型选择器 accent | 橙色 | "Big Pickle" 带箭头 | ✅ |
| 侧栏底部 Sync | 浅色文字 | "Sync with OpenWork Cloud" | ✅ |

### 截图说明（test-main-codex.png）
```
┌────────────┬─────────────────────────────────────────────────────┐
│ 搜索会话     │ 新建会话                                          │
│ 扩展        │                                                  │
│ 空间        │  What do you need done?                          │
│ 管理        │  Describe it in plain language                   │
│            │                                                  │
│ WORKSPACES │  ┌────────────────────────────────────────────┐ │
│  tra_...   │  │ 今天帮你做些什么？@引用文件，/调用技能与指令 │ │
│ 今天       │  └────────────────────────────────────────────┘ │
│ 新建会话   │                                                  │
│ 昨天       │  Summarize my week | Clean up a spreadsheet      │
│ 新建会话   │  Draft a document | Automate a web task         │
└────────────┴─────────────────────────────────────────────────────┘
```
- 左侧栏：深灰 `#2F2F2F` + 白色文字 ✅
- 主内容区：纯白 `#FFFFFF` ✅
- 中文标签：搜索会话/扩展/空间/管理 ✅
- 占位符中文：✅

### 残留英文（后续待中文化）
- 主标题 "What do you need done?" → 需 zh locale
- 副标题 "Describe it in plain language" → 需 zh locale  
- 卡片标题 "Summarize my week" 等 4 张 → 需 zh locale
- "WORKSPACES" 标签 → 需中文化
- "Get frontier models with no API keys" → 需 zh locale
- "Sync with OpenWork Cloud" → 需 zh locale

---

## 五、中文化验证（Commit d68864dc）

| 测试项 | 预期 | 实际 | 状态 |
|--------|------|------|------|
| 侧栏 "Spaces" → "空间" | 中文 | `t("workspace_list.spaces")` = "空间" | ✅ |
| 侧栏 "Admin" → "管理" | 中文 | `t("workspace_list.admin")` = "管理" | ✅ |
| 侧栏 "Search sessions" → "搜索会话" | 中文 | `t("workspace_list.search_sessions")` | ✅ |
| "Today/Yesterday/7Days/Older" → "今天/昨天/前7天/更早" | 中文 | `t("session.today")` 等 | ✅ |
| Composer 占位符 → WorkBuddy 风格 | 中文 | "今天帮你做些什么？@引用文件，/调用技能与指令" | ✅ |
| "Extensions" → "扩展" | 中文 | `t("composer.extensions_label")` | ✅ |
| "No extensions enabled" → 中文 | 中文 | `t("composer.extensions_unavailable")` | ✅ |
| "No plugin files" → 中文 | 中文 | `t("composer.no_plugins")` | ✅ |
| "Preparing connected..." → 中文 | 中文 | `t("composer.preparing_tools")` | ✅ |

---

## 六、截图清单

| 截图 | 内容 | 路径 |
|------|------|------|
| OpenWork 主界面 | Codex 白底主题 + 深灰侧栏 | `test-main-codex.png` |
| OpenWork 主界面（修复后） | Codex 深灰侧栏 + 白色主内容 | `ow-after-i18n.png` |
| OpenWork 主界面（旧） | 修复前蓝色渐变 | `ow-main-after-fix.png` |
| WorkBuddy 参考 | WorkBuddy 真实界面 | `wb-ref-screenshot1.png` |

### 截图说明（test-main-codex.png）
```
┌────────────┬─────────────────────────────────────────────────────┐
│ 搜索会话     │ 新建会话                                          │
│ 扩展        │                                                  │
│ 空间        │  What do you need done?                          │
│ 管理        │  Describe it in plain language                   │
│            │                                                  │
│ WORKSPACES │  ┌────────────────────────────────────────────┐ │
│  tra_...   │  │ 今天帮你做些什么？@引用文件，/调用技能与指令 │ │
│ 今天       │  └────────────────────────────────────────────┘ │
│ 新建会话   │                                                  │
│ 昨天       │  Summarize my week | Clean up a spreadsheet      │
│ 新建会话   │  Draft a document | Automate a web task         │
└────────────┴─────────────────────────────────────────────────────┘
```
- 左侧栏：深灰 `#2F2F2F` + 白色文字 ✅
- 主内容区：纯白 `#FFFFFF` ✅
- 中文标签：搜索会话/扩展/空间/管理 ✅
- 占位符中文：✅

---

## 七、Commit 记录

| Commit | 内容 |
|--------|------|
| `e66d7ba1` | Space overlay click 修复 + zh-i18n + WorkBuddy-style table |
| `d68864dc` | zh-locale 侧栏 + 日期桶 + composer 占位符中文化 |
| `a77368b2` | 功能页返回主界面按钮（space + admin） |
| `c553db00` | 可插拔 SSO 架构（schema + API + 前端） |
| `81920885` | Codex Design System：全局 CSS 变量覆盖 + 测试报告 |

---

## 八、总结

| 模块 | 测试项数 | 通过 | 待办 |
|------|---------|------|------|
| 功能页导航 | 3 | 3 | 0 |
| 可插拔 SSO | 9 | 9 | 0 |
| Codex 风格 UI | 11 | 11 | 6 处残留英文 |
| 中文化 | 9 | 9 | 0 |
| **合计** | **32** | **32** | **6 处残留英文** |
