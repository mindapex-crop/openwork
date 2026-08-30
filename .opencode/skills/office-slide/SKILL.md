---
name: office-slide
description: 将对话内容生成为演示文稿（.pptx）交付物。当用户要求"做成 PPT / 生成幻灯片 / 出一版演示文稿"时使用。
---

# Skill: office-slide

"对话到交付"工作流：把对话结论整理为演示文稿 `.pptx` 交付文件。

## 工作流

1. **整理大纲**：从对话中提取演示结构：标题、要点、表格，组织为 markdown（`# ` 标题 = 幻灯片内容主题，`- ` 列表 = 要点）。
2. **调用生成能力**：调用服务端的 `generateOfficeFile({ content, format: "pptx", filename })` 纯函数（`apps/server/src/opencode-plugins/openwork-office-generation-core.ts`），或通过 `openwork:deliver` 指令：

   ```
   openwork:deliver
   {"format":"pptx","filename":"deck.pptx","content":"# 主题\n\n- 要点一\n- 要点二"}
   ```

3. **交付**：生成文件写入 `.opencode/openwork/outbox/deliverables/` 并附到消息。告知文件位置与页数摘要。

## 生成规范

- `# ` 一级标题渲染为加粗大字，作为页面主标题。
- `- ` 列表渲染为项目符号要点；`| 列 |` 表格渲染为幻灯片表格。
- 一页内容不宜过长：正文保持 6–8 行要点以内。
- 文件命名：`<主题>.pptx`。

## 验收

- 文件以 `PK` 开头（合法 OOXML），能被 PowerPoint/WPS/LibreOffice 打开。
- 标题与要点完整覆盖对话结论，无编造数据。
- 交付后给出文件路径与要点条数摘要。
