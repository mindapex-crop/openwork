# Domain: expert-orchestration

Golden cases for the quality of agent **orchestration** outputs: task planning,
decomposition, delegation to skills/agents, and tool-selection rationale.

- Typical input: a workspace state fixture plus a user task prompt.
- Typical graded output: a plan or orchestration trace.
- Grading mode: primarily `llm-judge` with a rubric (are steps ordered,
  delegated to the right skill, and grounded in the workspace state?);
  deterministic validators only where structure is guaranteed (e.g. plan
  schema, allowed tool list).

## Cases

Cases live in `cases/` as `<case-id>.json` following the golden-set format in
`evals/quality/README.md`. Intentionally empty at skeleton stage.
