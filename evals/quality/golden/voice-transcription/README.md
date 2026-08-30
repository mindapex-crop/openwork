# voice-transcription（语音转写）— 待接占位域

本目录为 **L2 质量层首批域之一「语音转写」** 的占位。当前阶段（L2 骨架 PR）只落地了
`i18n-completeness` 与 `expert-orchestration` 两个域；本域待后续 PR 接入。

## 接入计划（随阶段三「语音」落地）

- **被测对象**：`voice-panel` 扩展后的语音输入/对话/TTS（见
  `prds/workbuddy-refactor/roadmap.md` 阶段三）。
- **判定模式**：
  - 转写保真（固定语料音频 → 文本，与 golden 转录对照的 WER / 关键片段命中）→
    **确定性判定**（结构化对照）。
  - 语义/结构（分段、标点、专有名词大小写）→ **LLM judge**（rubric + seed）。
- **golden case 位置**：`golden/voice-transcription/cases/<case-id>.json`，格式见
  `evals/quality/judge.ts` 的 `GoldenCase`。

## 约束

- 音频语料固定、体积小、可重放；不使用真实用户语音。
- 判定必须可复现：LLM judge 一律带固定 seed 与版本化 prompt。
