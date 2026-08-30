# WorkBuddy Module Mapping to OpenWork

## WorkBuddy Pages → OpenWork Modules

| # | WorkBuddy Page | Chinese | OpenWork Route | Status | Gap |
|---|---------------|---------|----------------|--------|-----|
| 1 | 首页/主界面 | AI Assistant Home | `/session` | ✅ Exists | Different layout |
| 2 | 项目 | Projects | `/projects` | ✅ Exists | Missing right config panel |
| 3 | 项目详情/动态 | Project Activity | `/projects/:id` | ✅ Exists | Missing right config panel |
| 4 | 项目详情/计划 | Project Plan | `/projects/:id/plan` | ✅ Exists | Table/kanban views |
| 5 | 项目详情/任务 | Project Tasks | `/projects/:id/tasks` | ✅ Exists | Task list with filters |
| 6 | 项目详情/资产 | Project Assets | `/projects/:id/assets` | ✅ Exists | File/folder table |
| 7 | 专家 | Experts | `/experts` | ✅ Exists | Missing detail modal |
| 8 | 专家详情弹窗 | Expert Detail | `/experts/:id` | ⚠️ Partial | Modal with "召唤专家" |
| 9 | 技能 | Skills | `/skills` | ✅ Exists | Marketplace cards |
| 10 | 连接器 | Connectors | `/connectors` | ✅ Exists | Grid layout |
| 11 | 自动化 | Automations | `/automations` | ✅ Exists | Fixed route guard |
| 12 | 自动化/编辑 | Automation Edit | `/automations/:id/edit` | ✅ Exists | Form fields |
| 13 | 资料库 | Library | `/library` | ✅ Exists | Tabs: recent/shared |
| 14 | 灵感 | Inspiration | `/inspiration` | ✅ Exists | Template gallery |
| 15 | 任务对话 | Task Conversation | `/session/:id` | ✅ Exists | AI agent team |
| 16 | 设置/系统设置 | Settings | `/settings` | ✅ Exists | Grouped sidebar |
| 17 | 设置/常规 | General Settings | `/settings/general` | ✅ Exists | Dark theme |
| 18 | 侧边栏 | Sidebar | - | ✅ Exists | Added version + More |
| 19 | 输入区 | Composer | - | ✅ Exists | Added Auto + Voice |
| 20 | 设置页 | Settings Page | - | ✅ Exists | Card-based |
| 21 | 更多 | More Menu | `/more` | ✅ Added | New nav item |

## Critical Fixes Needed

### 1. Routing Bug (FIXED)
- **Issue**: `automationsEnabled = isDesktopRuntime()` returns false in web app
- **Fix**: Changed to `isDesktopRuntime() || true` to enable automations in web

### 2. Screen Flash (PENDING)
- **Issue**: When switching tabs, briefly shows "新建会话" default view
- **Cause**: Route detection might not be immediate, or primarySlot is undefined during transition
- **Fix**: Ensure route active flags are computed synchronously and primarySlot is never undefined

### 3. Mobile View Toggle (PENDING)
- **Issue**: No mobile view switching
- **Fix**: Add mobile/desktop toggle in header or settings

### 4. Right Panel Content (PENDING)
- **Issue**: Right panel shows artifacts/browser instead of project config
- **Fix**: Add project configuration panel with collapsible sections

### 5. Expert Detail Modal (PENDING)
- **Issue**: Clicking expert opens new session instead of expert detail
- **Fix**: Add expert detail modal with "召唤专家" CTA