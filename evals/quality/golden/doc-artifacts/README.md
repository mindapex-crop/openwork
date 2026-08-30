# doc-artifacts（文档产物）— 待接占位域

本目录为 **L2 质量层首批域之一「文档产物」** 的占位。当前阶段（L2 骨架 PR）只落地了
`i18n-completeness`（确定性扫描）与 `expert-orchestration`（确定性编排判定）两个域；
本域与 `voice-transcription` 待后续 PR 接入。

## 接入计划（随阶段三「交付能力」落地）

- **被测对象**：`docx/pptx/xlsx/pdf` 生成技能（对话到交付，见
  `prds/workbuddy-refactor/roadmap.md` 阶段三）。
- **判定模式**：
  - 结构化部分（文件树、目录清单、章节标题集合、表格列名）→ **确定性判定**
    （`ExpectedSpec` 的 shape / keys / exact）。
  - 内容质量（总结是否忠实、措辞是否通顺）→ **LLM judge**（rubric + seed，
    `llm-judge.ts` 已就绪，client 可注入）。
- **golden case 位置**：`golden/doc-artifacts/cases/<case-id>.json`，格式见
  `evals/quality/judge.ts` 的 `GoldenCase`。

## 约束

- 不复制真实用户数据进 case（见 `evals/quality/README.md` 规则）。
- 判定必须可复现：LLM judge 一律带固定 seed 与版本化 prompt。
