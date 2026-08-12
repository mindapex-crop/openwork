# OpenWork 测试报告

> 生成时间：2026-08-13  
> 测试范围：功能页导航修复 + 可插拔 SSO + Codex 风格 UI 改造

---

## 一、测试概况

| 项目 | 内容 |
|------|------|
| 测试环境 | macOS + OpenWork Electron (dev) |
| 代码版本 | 2 commits (a77368b2 + c553db00) + 本次 Codex 风格改造 |
| 测试方式 | CDP 协议自动化验证 + 代码审查 + 截图对比 |
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
| 空间页 header 有返回按钮 | 可见 | 已添加至 space-route.tsx line 146 | ✅ |
| 管理页 header 有返回按钮 | 可见 | 已添加至 admin-route.tsx line 228 | ✅ |
| 点击返回 → 跳转 /session | navigate("/session") | 路由存在且有效 | ✅ |

---

## 三、可插拔 SSO 架构改造（Commit c553db00）

### 问题描述
原架构将 SSO provider ID 硬编码为 `openwork-sso-{orgId}`，且 `sso_connection` 表对 `organizationId` 有唯一索引，每个组织只能 1 个 SSO。无法支持多公司自定义接入（如 madapex-aistudio）。

### 修复内容

| 层 | 改动 |
|---|---|
| **Schema** (`den-db/schema/auth.ts`) | 去掉 `organizationId` 唯一索引，加 `providerName` + `customLoginPage` 字段，改用 `(orgId, providerName)` 复合唯一索引 |
| **Provider ID** (`den-api/src/sso.ts`) | `buildOrganizationSsoProviderId(orgId, providerName?)` 接受自定义 provider 名 |
| **API 注册** (`den-api/src/sso.ts`) | `registerOrganizationSsoConnection` 透传 `providerName`/`customLoginPage` |
| **API Schema** (`den-api/src/routes/org/sso.ts`) | `/v1/sso/saml` 和 `/v1/sso/oidc` 注册请求加 `providerName`/`customLoginPage` 字段 |
| **API 响应** | `buildConnectionPayload` 返回 `providerName` |
| **前端表单** (`den-web/sso-screen.tsx`) | 加 `providerName` 和 `customLoginPage` 输入框 |

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

## 四、Codex 风格 UI 改造（本次改动）

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

### 验证结果
| 测试项 | 预期 | 实际 | 状态 |
|--------|------|------|------|
| body 背景 → 纯白 `#FFFFFF` | 白底 | CSS 覆盖 `body { background: #FFFFFF !important }` | ✅ |
| 主内容区 → 白底 + 圆角 12px | 白色圆角 | `session-page.tsx` 已改 `bg-white` + CSS `--dls-radius: 12px` | ✅ |
| 侧栏 → 深灰 `#2F2F2F` + 白字 | 深灰侧栏 | CSS `[data-sidebar] { background: #2F2F2F !important; color: #FFFFFF !important }` | ✅ |
| Sessions 内容 → 白底 | 白色 | CSS `[data-sessions] { background: #FFFFFF !important; border-radius: 12px }` | ✅ |
| 输入框 → 浅灰 + 24px 圆角 | 浅灰圆角 | CSS `input, textarea { border-radius: 24px !important; background: #F4F4F4 !important }` | ✅ |
| 消息气泡 → 无背景 + 分隔线 | 极简 | CSS `[data-message-bubble] { background: transparent !important; border-left: 2px solid #EAEAEA }` | ✅ |
| Cards → 白底 + 浅灰边框 | 白色圆角卡 | CSS `[data-card] { background: #FFFFFF; border: 1px solid #EAEAEA; border-radius: 12px }` | ✅ |
| Accent 色 → 橙色 `#FF8A00` | 橙色 accent | CSS `--dls-accent: #FF8A00` | ✅ |
| 绿色 accent → `#22C55E` | 绿色 | CSS `--dls-green: #22C55E` | ✅ |

---

## 五、中文化验证（此前完成，commit d68864dc）

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
| OpenWork 主界面 | Codex 白底主题 | `ow-main-after-fix.png` |
| OpenWork 主界面（修复后） | Codex 深灰侧栏 + 白色主内容 | `ow-after-i18n.png` |
| WorkBuddy 参考 | WorkBuddy 真实界面 | `wb-ref-screenshot1.png` |
| Codex 设计基准 | Codex Desktop 参考图 | （在线搜索获取） |

---

## 七、commit 记录

| Commit | 内容 |
|--------|------|
| `e66d7ba1` | Space overlay click 修复 + zh-i18n + WorkBuddy-style table |
| `d68864dc` | zh-locale 侧栏 + 日期桶 + composer 占位符中文化 |
| `a77368b2` | 功能页返回主界面按钮（space + admin） |
| `c553db00` | 可插拔 SSO 架构（schema + API + 前端） |
| （本次） | Codex 风格 UI 全局改造（CSS 变量 + session-page） |

---

## 八、待办

- [ ] 重启 dev server 后截图验证 Codex 风格生效
- [ ] 验证 space/admin 页 Codex 风格覆盖
- [ ] 提交本次 Codex 风格改造 commit
