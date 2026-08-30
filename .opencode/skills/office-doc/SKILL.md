---
name: office-doc
description: 将对话结论生成为 Word 文档（.docx）交付物。当用户要求"导出为 Word 文档 / 生成 docx 文档 / 出一份正式报告文件"时使用。
---

# Skill: office-doc

"对话到交付"工作流：把当前对话中的结论、要点、表格整理成 markdown 结构，再生成 `.docx` 交付文件，让用户直接下载或保存。

## 工作流

1. **整理内容**：从对话中提取标题、段落、列表、表格与代码块，组织为清晰的 markdown 文本。
2. **调用生成能力**：调用服务端的 `generateOfficeFile({ content, format: "docx", filename })` 纯函数（`apps/server/src/opencode-plugins/openwork-office-generation-core.ts`），或通过 `openwork:deliver` 指令让插件代为生成：

   ```
   openwork:deliver
   {"format":"docx","filename":"report.docx","content":"# 标题\n\n正文…"}
   ```

3. **交付**：生成的文件会作为 file part 写入工作区 `.opencode/openwork/outbox/deliverables/` 并附到消息上。告知用户文件位置与内容摘要。

## 生成规范

- 标题用 `# `（一级）/ `## `（二级）markdown 前缀，生成后映射为 Word 标题样式。
- 表格用 `| 列 | 列 |` 管道语法，生成真实 Word 表格。
- 列表项用 `- ` 前缀，生成 Word 编号/项目符号列表。
- 代码块用 ```` ``` ```` 围栏，生成等宽字体段落。
- 文件命名：`<主题>.docx`，避免空格与特殊字符。

## 验收

- 文件以 `PK` 开头（合法 zip/OOXML），能被 Word/WPS/LibreOffice 打开。
- 正文、标题、表格内容与对话结论一致，无遗漏、无编造。
- 交付后给出文件路径与字数/表格数摘要。
