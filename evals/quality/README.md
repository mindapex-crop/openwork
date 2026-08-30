# Quality layer (L2)

本目录是评测体系 **L2 质量层** 的实现。总纲见
`prds/workbuddy-refactor/roadmap.md` §评测体系(四层金字塔):L2 = `evals/quality/`
golden set + 混合判定(结构化输出确定性判定;开放输出 LLM judge 带 rubric+seed)。

## 定位

| 层 | 回答的问题 | 位置 |
| --- | --- | --- |
| L1 规格层 | 应用行为是否符合批准脚本 | `evals/specs/**`(testkit) |
| **L2 质量层** | **模型/系统产出的内容质量是否达标** | **`evals/quality/`(本目录)** |
| L3 一致性层 | Relay Sync 故障注入下的状态一致性 | 随阶段四(未落地) |
| L4 冒烟层 | 每日端到端用户旅程巡检 | `evals/specs/daily-journey.slow.test.ts` + `.github/workflows/daily-smoke.yml` |

## 目录结构

```
evals/quality/
├── README.md                本文件
├── judge.ts                 判定器契约:GoldenCase / ExpectedSpec / Rubric / Verdict
├── deterministic-judge.ts   确定性判定:exact / shape / keys / invariants + driftPolicy
├── llm-judge.ts             LLM judge:rubric+seed prompt 模板;LLM client 可注入(默认 mock)
├── index.ts                 入口 re-export
├── run.ts                   golden 运行器:扫描 golden/ → 执行判定 → 输出 markdown/json 报告
├── run.test.ts              run.ts 与判定器测试(进 vitest pr lane)
├── scanners/
│   └── i18n-scanner.ts      i18n 完整性扫描核心(scripts/i18n-audit.mjs 同源复用)
├── runners/
│   ├── i18n-completeness.ts   i18n 域 runner:跑扫描 → 产出 report/invariants/drift
│   └── expert-orchestration.ts 专家编排域 runner:调用产品 selectMember / filterMembersByCapabilities / STRATEGY_META
├── golden/
│   ├── i18n-completeness/golden.json        首批域①:i18n 完整性(已接)
│   ├── expert-orchestration/cases/*.json    首批域②:专家编排(已接)
│   ├── doc-artifacts/README.md              占位域(待接,阶段三)
│   └── voice-transcription/README.md        占位域(待接,阶段三)
└── reports/                  运行产物:latest.json / latest.md(不入库)
```

## 判定规则(混合判定)

每个 golden case 的 `grading.mode` 二选一,不可混用:

1. **确定性判定(`deterministic`)** — 结构化输出对照 golden 期望,零方差、无 LLM:
   - `exact`:深比较字面值
   - `shape`:必填字段存在 + 字段类型匹配
   - `keys`:键集合 contains/excludes
   - `invariants`:runner 报告的命名不变量全部为真(如 i18n 的自洽性/无重复)
   - `driftPolicy`:`"fail"`(测得漂移即失败)或 `"report"`(记录漂移作为 worklist 但通过)
2. **LLM judge(`llm-judge`)** — 开放输出带 rubric 评分:
   - 每个 case 带 `rubric`(有序判据,各有权重与 `required` 标记)、`seed`(固定种子)、
     `passThreshold`(加权分门槛)、`judgePromptVersion`(版本化 prompt)
   - 通过条件:所有 `required` 判据得 1 分 **且** 加权分 ≥ passThreshold
   - LLM client 可注入:`createMockLlmClient`(测试默认)/ `createHttpLlmClient`
     (真实,env `OPENWORK_EVAL_LLM_ENDPOINT` / `OPENWORK_EVAL_LLM_API_KEY` /
     `OPENWORK_EVAL_LLM_MODEL`);回复解析为
     `{"scores": {"<判据>": 0|1}, "comment": "..."}`

## 首批域覆盖清单

| 域 | 状态 | 被测对象 | 判定 |
| --- | --- | --- | --- |
| `i18n-completeness` | ✅ 已接 | `apps/app/src/i18n/locales/*.ts` 扫描(核心在 `scanners/i18n-scanner.ts`,与 `scripts/i18n-audit.mjs` 同源) | deterministic:4 条 invariants(基线为真源/报告自洽/差异有序且不重叠/无重复 key);`driftPolicy=report`(漂移量进入报告,作为 i18n 重构 worklist) |
| `expert-orchestration` | ✅ 已接 | 产品编排函数 `apps/server/src/agent-team/{dispatch,team-strategies}.ts`(运行时动态 import,不引入产品类型图) | deterministic:exact(选中 agent / eligible 列表)/ shape(策略 meta 表面) |
| `doc-artifacts` | ⏳ 占位 | 阶段三 docx/pptx/xlsx/pdf 生成技能 | 待接:结构化部分 deterministic;内容质量 llm-judge |
| `voice-transcription` | ⏳ 占位 | 阶段三语音(voice-panel 完整化) | 待接:转写保真 deterministic;语义结构 llm-judge |

## 使用方式

```bash
cd evals
pnpm run quality              # 跑全部 golden case → stdout markdown + reports/latest.{json,md}
pnpm run quality:i18n-scan    # 仅 i18n 扫描(JSON 到 stdout,exit 1 当有漂移)
node quality/run.ts --golden-dir <dir> --out-dir <dir>
```

- 退出码:任一 case 失败 → 1(可接 CI gate)。
- 测试:`pnpm run spec` 会包含 `quality/run.test.ts`(vitest pr lane,
  `vitest.config.ts` 已把 `quality/**/*.test.ts` 纳入)。

## 规则

- golden case 最小、自包含、稳定;不复制真实用户数据。
- 确定性 case 对漂移大声失败;漂移数据是重构输入,不是 flake。
- LLM judge 一律带固定 seed 与版本化 prompt,保证可复现。
- 新增域:在 `runners/` 写 runner(产出 judge 友好的 actual),在 `golden/<domain>/`
  放 case,并在 `run.ts` 的 `runCase` 注册。

## 与 L4 的关系

L4 冒烟(`daily-journey.slow.test.ts` + `daily-smoke.yml`)跑端到端用户旅程
(新建任务→云端接力→IM 下发→产物落库);L2 是对同一批域做内容质量的离线 golden 判定。
两者互补:冒烟证明「旅程走得通」,质量层证明「产出的东西够好」。
