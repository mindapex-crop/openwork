# Quality layer (L2)

This directory is the skeleton of the **L2 LLM-output-quality layer** of the
evaluation pyramid. The canonical roadmap lives in
`prds/workbuddy-refactor/roadmap.md` (评测体系 section); this README is the
in-repo contract for L2.

## Where L2 sits

| Layer | Question it answers | Where it lives | Cost per run |
| --- | --- | --- | --- |
| L0 — deterministic unit invariants | Does the code do what it says? | package-level vitest suites | cheapest |
| L1 — app-driving behavior | Does the app behave right end to end? | `evals/specs/**` (testkit tape) | medium |
| **L2 — output quality** | **Is what the model produces good enough?** | **`evals/quality/` (this dir)** | medium–high |
| L3 — longitudinal agent journeys | Does the agent stay good over long horizons? | future | highest |

L0/L1 prove *behavior*; L2 proves *quality of generated content*. Until now the
repo had no LLM-output-quality evaluation at all — this skeleton introduces the
structure, the golden-set conventions, and the first runnable checker.

## Hybrid verdict strategy

Every case declares exactly one grading mode. Never mix modes inside one case.

- **Structured output → deterministic judgment.** When the expected output has
  a shape (JSON, key sets, file trees, tables), the case ships a validator:
  literal equality, JSON Schema, regex, or a named check function. Zero
  variance, runs in the `pr` vitest project, no model calls. The i18n
  completeness scanner (below) is the first instance of this mode.
- **Open-ended output → LLM judge with rubric.** For prose, plans, and other
  free-form artifacts, a case ships a *rubric*: an ordered list of criteria,
  each with a weight and a `required` flag, plus a pinned judge model and a
  versioned judge prompt. A verdict is `Passed` only when every required
  criterion is met and the weighted score clears the case's threshold. The
  judge lane is future work — the skeleton reserves the case format only.

## Golden set

Location: `golden-set/domains/<domain>/cases/<case-id>.json`. One JSON file
per case; never copy live user data into a case.

Common fields:

```jsonc
{
  "id": "doc-artifacts.changelog-pr-summary-001",
  "domain": "doc-artifacts",
  "input": {
    "prompt": "…",
    "fixtures": ["golden-set/fixtures/…"]   // optional, relative paths
  },
  "grading": {
    "mode": "deterministic" | "llm-judge",
    // deterministic mode:
    "expected": { /* literal or JSON Schema */ },
    "validators": ["exact-match"]           // named checks, versioned in this repo
    // llm-judge mode:
    // "rubric": [{ "criterion": "…", "weight": 1, "required": true }],
    // "judgeModel": "…", "judgePromptVersion": "…", "passThreshold": 0.8
  },
  "metadata": { "skill": "…", "notes": "…" }
}
```

Rules:

- Cases are minimal, self-contained, and stable — a case that needs to change
  every week is not a golden case.
- Deterministic cases must fail loudly on drift; drift data is an input to
  refactors, not a flake.
- **Skeleton stage:** directory structure and conventions only — the `cases/`
  directories are intentionally empty until real cases are authored.

Domains:

- `expert-orchestration/` — quality of agent planning/delegation outputs.
- `doc-artifacts/` — generated documents (reports, changelogs, READMEs).
- `voice-transcription/` — speech-to-text fidelity and structure.
- `i18n-completeness/` — translation coverage; fully deterministic, runnable
  today (see below).

## Running

All commands run from the `evals/` workspace root (it is a standalone pnpm
workspace).

### i18n completeness scan (deterministic, runnable today)

```bash
cd evals
pnpm quality:i18n-scan                       # scan apps/app/src/i18n/locales vs "en"
node quality/i18n-completeness/scan.ts [dir] [--baseline <locale>] [--out report.json]
```

- Prints a JSON report to stdout (or writes it with `--out`), plus a
  per-locale drift summary to stderr.
- Exit code `1` when any locale has missing or extra keys relative to the
  baseline — safe to wire into CI as a gate once the current drift is burned
  down.
- The report lists every missing/extra key per locale; it is the worklist for
  the i18n refactor.

### Tests

```bash
cd evals
pnpm vitest run --config vitest.config.ts --project pr specs/i18n-completeness.test.ts
pnpm test:pr                                  # full PR lane (app-less specs)
```

The spec covers the scanner's diff/flatten logic with fixtures and runs a real
scan over the ten shipped locale files, asserting the report reconciles
(`keyCount = baseline − missing + extra`) and recording the actual drift
numbers on the testkit tape.
