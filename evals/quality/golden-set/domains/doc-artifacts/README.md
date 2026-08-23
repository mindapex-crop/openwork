# Domain: doc-artifacts

Golden cases for the quality of **generated documents**: PR summaries,
changelogs, reports, README-style artifacts the agents produce from repo state.

- Typical input: a fixture repo snapshot (files, diffs) plus a generation
  prompt.
- Typical graded output: a markdown artifact.
- Grading mode: hybrid — deterministic validators for structure (required
  sections, links resolve, no placeholder text), `llm-judge` with a rubric for
  prose quality (accuracy vs the fixture, no invented facts, appropriate
  length/tone).

## Cases

Cases live in `cases/` as `<case-id>.json` following the golden-set format in
`evals/quality/README.md`. Intentionally empty at skeleton stage.
