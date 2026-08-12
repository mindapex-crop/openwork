# Handoff Context — OpenWork 主界面重构

## Current State
- **Commit**: `e66d7ba1` (feat/team-autonomy branch) — just committed
- **Running**: OpenWork-Dev (Electron 54174, CDP 9223), WorkBuddy (6 processes)
- **Language**: zh locale via localStorage injection, app-shell auto-detect

## What Was Done
1. ✅ Git commit (63 files, 6336 insertions)
2. ✅ Observed WorkBuddy main interface via desktop screenshot — identified full layout structure
3. ✅ Fixed LoadingOverlay pointer-events-auto blocking clicks
4. ✅ Fixed space-route/admin-route missing markRouteReady()
5. ✅ Space page: WorkBuddy-style table layout + zh labels + skeleton
6. ✅ Sidebar i18n: `Spaces` → "空间", `Admin` → "管理", "Toggle Sidebar"/"Search sessions" → "搜索会话", Today/Yesterday/7Days/Older → "今天/昨天/前7天/更早"
7. ✅ Composer placeholder: "描述你的任务…" → "今天帮你做些什么？@引用文件，/调用技能与指令" (WorkBuddy style)
8. ✅ Composer hardcoded English: "Extensions" → i18n, "No extensions enabled" / "No plugin files" / "Preparing connected service tools" → i18n
9. ✅ New zh locale keys: `workspace_list.spaces`, `workspace_list.admin`, `workspace_list.search_sessions`, `session.today/yesterday/previous_7_days/older`, `composer.extensions_label/unavailable/no_plugins/plugins_unavailable/preparing_tools`

## Current Uncommitted Changes (NOT YET COMMITTED)
Files modified since last commit:
- `apps/app/src/react-app/domains/session/sidebar/app-sidebar.tsx`
  - Line 1177-1188: `label="Spaces"` → `label={t("workspace_list.spaces")}`, same for Admin
  - Line 899-907: `return "Today"` → `return t("session.today")` etc.
- `apps/app/src/react-app/domains/session/surface/composer/composer.tsx`
  - Line 1504: `["extensions", "Extensions"]` → `["extensions", t("composer.extensions_label")]`
  - Line 1745: `"No extensions enabled..."` → `t("composer.extensions_unavailable")`
  - Line 1773: `"No plugin files imported yet."` → `t("composer.no_plugins")`
  - Line 1777: `"Plugin files are unavailable."` → `t("composer.plugins_unavailable")`
- `apps/app/src/i18n/locales/zh.ts`
  - Line 96: placeholder changed to WorkBuddy style
  - Line 1148-1151: new keys `spaces/admin/search_sessions`
  - Line 94-98: new keys `extensions_label/unavailable/no_plugins/plugins_unavailable/preparing_tools`
  - Line 561-564: new keys `today/yesterday/previous_7_days/older`

## WorkBuddy Layout Analysis (from screenshot)
| Area | WorkBuddy | OpenWork needs |
|------|-----------|---------------|
| Left sidebar top | 新建任务/助理/项目/专家·技能·连接器/自动化/资料库/更多 | Add these modules with zh labels |
| Sidebar bottom | 空间(2) with workspace list | Already has Spaces section |
| Main area title | "WorkBuddy, 我帮你" + scenario tags (日常办公/代码开发/设计创意) | Add greeting + tags |
| Quick actions row | 文档处理/金融服务/数据/工作台/幻灯片 | Add horizontal quick-access chips |
| Composer | 占位符 + 附件/MCP/模型下拉/语音/发送 | Placeholder done, voice NOT done |
| Footer | 选择工作空间/默认权限 | Add workspace selector + permissions pill |

## Key Code References
- **Sidebar destinations**: `app-sidebar.tsx` lines 1169-1190 (where Spaces/Admin are rendered)
- **Composer + menu**: `composer.tsx` lines 1496-1515 (tool menu sections with hardcoded "Extensions")
- **Placeholder**: `composer.tsx` line 1362 — `placeholder={t("composer.placeholder")}`
- **Date bucket labels**: `app-sidebar.tsx` lines 898-909

## Next Steps (NOT YET DONE)
1. **Commit current changes**
2. **Voice input button**: Add mic icon button next to send button in composer (WorkBuddy has 语音 input on right side of input bar)
3. **Greeting/scenario tags**: Add "OpenWork, 我帮你" title + scenario tag chips (日常办公/代码开发/设计创意) to empty state
4. **Quick actions row**: Horizontal chips (文档处理/金融服务/数据分析/个人工作台/幻灯片) below greeting
5. **Footer workspace selector**: "选择工作空间" + "默认权限" pills
6. **Add missing sidebar modules**: 自动化/资料库/更多 following WorkBuddy structure
7. **Restart and verify** all UI changes

## Verification Method
```bash
node cdp-full-zh.mjs    # Full zh i18n verification across all routes
```
Or manually via desktop screenshot comparing WorkBuddy vs OpenWork layouts.

## Known Issues
- `en.ts` was NOT updated (should mirror zh keys for consistency — use different casing from initial attempt)
- Voice input, greeting section, quick actions, footer pills — NOT YET IMPLEMENTED
- No full restart/validation run yet for the uncommitted i18n changes