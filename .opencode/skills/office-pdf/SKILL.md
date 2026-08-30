---
name: office-pdf
description: 将对话内容生成为 PDF 文档交付物。当用户要求"导出为 PDF / 生成 pdf 文件 / 出一份可打印的文档"时使用。
---

# Skill: office-pdf

"对话到交付"工作流：把对话结论排版为 `.pdf` 交付文件（可直接打印、分享）。

## 工作流

1. **整理内容**：提取标题、段落、要点、表格，组织为 markdown。
2. **调用生成能力**：调用服务端的 `generateOfficeFile({ content, format: "pdf", filename })` 纯函数（`apps/server/src/opencode-plugins/openwork-office-generation-core.ts`），或通过 `openwork:deliver` 指令：

   ```
   openwork:deliver
   {"format":"pdf","filename":"brief.pdf","content":"# 摘要\n\n正文…"}
   ```

3. **交付**：生成文件写入 `.opencode/openwork/outbox/deliverables/` 并附到消息。告知文件位置与页数摘要。

## 生成规范

- 生成器输出标准 PDF 1.4（Helvetica 字体），以 `%PDF` 头开始，可被常见阅读器解析。
- 长内容自动分页；表格行按 `| 列 |` 拼接为文本行。
- 当前生成器为纯文本排版：中文字符会降级为 `?`，重要中文内容请优先交付 docx。
- 文件命名：`<主题>.pdf`。

## 验收

- 文件以 `%PDF-1.` 开头且含 `%%EOF`，能被 Preview / Acrobat / PDF.js 打开。
- 内容与对话结论一致，无遗漏。
- 交付后给出文件路径与页数摘要。
