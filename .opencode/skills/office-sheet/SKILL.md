---
name: office-sheet
description: 将对话数据生成为电子表格（.xlsx）交付物。当用户要求"导出为 Excel / 生成 xlsx 表格 / 把数据做成表"时使用。
---

# Skill: office-sheet

"对话到交付"工作流：把对话中的数据整理为电子表格 `.xlsx` 交付文件。

## 工作流

1. **整理数据**：从对话中提取结构化数据（表头 + 行）。用 markdown 表格表达：

   ```
   | 指标 | 数值 |
   | --- | --- |
   | 收入 | 1742.42 |
   ```

   非表格内容（说明性文字）会逐行写入 A 列，请优先使用表格表达数据。
2. **调用生成能力**：调用服务端的 `generateOfficeFile({ content, format: "xlsx", filename })` 纯函数（`apps/server/src/opencode-plugins/openwork-office-generation-core.ts`），或通过 `openwork:deliver` 指令：

   ```
   openwork:deliver
   {"format":"xlsx","filename":"workbook.xlsx","content":"| 指标 | 数值 |\n| 收入 | 1742.42 |"}
   ```

3. **交付**：生成文件写入 `.opencode/openwork/outbox/deliverables/` 并附到消息。告知文件位置与行列摘要。

## 生成规范

- 每行一个 markdown 表格行 = 电子表格一行；单元格按 `|` 分隔。
- 表头行也按普通行写入（首行即表头数据）。
- 避免合并单元格/公式等复杂需求：当前生成器输出纯文本单元格。
- 文件命名：`<主题>.xlsx`。

## 验收

- 文件以 `PK` 开头（合法 OOXML），能被 Excel/WPS/LibreOffice 打开。
- 行、列与对话中的数据一一对应，数值无篡改。
- 交付后给出文件路径与行列数摘要。
