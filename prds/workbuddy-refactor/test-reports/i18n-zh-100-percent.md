# 测试报告 · OpenWork 中文界面 i18n 完整性修复（zh → 100%）

| 项 | 值 |
|---|---|
| 报告日期 | 2026-08-26 |
| 分支 | `feature/codex-advanced-features-local` |
| 范围 | `apps/app/src/i18n/locales/zh.ts` 补全 + 回归测试 |
| 关联问题 | 中文界面大量字符串回退英文（zh 覆盖率 66%） |
| 结论 | **通过**（zh 100% 对齐 en，0 缺失 / 0 多余 / 0 重复 / 占位符完整 / 复数完整 / typecheck 通过） |

---

## 1. 问题诊断

- 基线 `en.ts` 含 **2203** 个 key；修复前 `zh.ts` 仅 **1446** 个 key（**66%**），缺失 **761** 个。
- 根因一：`scripts/i18n-audit.mjs --ci` 明确「不因非英文 locale 缺 key 而失败」，漂移长期静默累积。
- 根因二：`zh.ts` 存在 **4 个历史遗留的裸复数 key**（`den.status_loaded_orgs`、`extensions.plugin_count`、`model_picker.model_count`、`status.providers_connected`），`en.ts` 仅定义 `_one/_other` 变体，导致 L2 质量扫描器（`scanI18nDirectory`，纯集合 diff）判定 zh 有 4 个 extra key。

## 2. 修复内容

1. 新增 **761** 个中文 key（`welcome/composer/session*/settings/memory/models/notifications/extensions/mcp/den/join_org/workspace_list/skills/projects/status/connect/…` 全命名空间）。
2. 删除 **4** 个历史裸复数 key（其语义已由新增的 `_one/_other` 变体覆盖，且 `Intl.PluralRules("zh")` 恒为 `other`，运行时安全）。
3. 新增回归测试 `apps/app/tests/i18n-completeness.test.ts`。

## 3. 测试用例设计

| 用例 | 描述 | 断言 | 结果 |
|---|---|---|---|
| TC1 | zh 无缺失 key | `enKeys - zhKeys == []` | ✅ |
| TC2 | zh 无多余 key（孤儿） | `zhKeys - enKeys == []` | ✅ |
| TC3 | zh 无重复 key | `duplicates(zhKeys) == []` | ✅ |
| TC4 | 占位符完整性 | 每个 zh 值的 `{placeholder}` 集合与 en 一致 | ✅ |
| TC5 | zh 运行时返回中文（非英文回退） | `t("common.back")==="返回"` 等 6 个代表 key | ✅ |
| TC6 | 回退链 | 缺失 key 回退 en；完全未知 key 返回 key 本身 | ✅ |
| TC7 | 语言即时切换（既有用例） | `i18n-live-switch.test.ts` 5 用例 | ✅ |

## 4. 端到端验证结果（证据）

```
# L2 质量扫描器（权威来源）
zh keyCount=2203  missing=0  extra=0   （修复前：keyCount=1446 missing=761 extra=4）

# i18n 审计（脚本）
zh: ✓ no missing   ✓ no orphans   ✓ no duplicates
Placeholder integrity: ✓ all placeholders preserved
Plural completeness:  ✓ all plural keys complete

# 单元测试
bun test i18n-completeness.test.ts i18n-live-switch.test.ts
→ 11 pass / 0 fail / 26 expect() calls

# 类型检查
pnpm --filter @openwork/app typecheck  →  exit 0
```

## 5. 截图证据

> 占位说明：本环境未接入 Feishu/浏览器截图工具链，暂无实时 UI 截图。需在运行中的桌面/headless 实例上抓取以下两处界面作为截图证据：

1. **设置 → 语言 = 简体中文** 后，欢迎页渲染中文：`欢迎使用 OpenWork` / `选择一个文件夹`。
2. **会话页** 输入区/顶部操作渲染中文：`发送` / `更多发送选项` / 通知面板标题 `通知`。

复现命令（在设备上）：

```bash
pnpm dev:headless-web --detach   # 启动隔离 UI + openwork-server
# 读取 tmp/dev-headless-web.json 的 webUrl，登录后切换语言为简体中文并截图
```

---

## 6. 遗留项（后续工作流）

- 其余 8 个 locale 仍约 57% 覆盖（各 ~950 key 缺失）——独立工作流。
- `--ci` 尚未对漂移强制失败——建议接 L2 `scanI18nDirectory` 作为 CI 门禁。
- 功能型差距（Credits 计费、专家/专家团产品层、移动端 + Relay Sync、语音、多端协同）为 P0/P1 独立工作流。