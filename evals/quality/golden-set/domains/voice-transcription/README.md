# Domain: voice-transcription

Golden cases for **speech-to-text** quality: transcription fidelity, speaker
separation, timestamping, and downstream formatting.

- Typical input: a short bundled audio fixture plus a transcription prompt.
- Typical graded output: a transcript (segments, speakers, timestamps).
- Grading mode: deterministic validators for structure (segment schema,
  monotonic timestamps, expected speaker count); content fidelity starts as
  `llm-judge` with a rubric and may move to an alignment-based metric (e.g.
  WER) once reference transcripts are curated.

## Cases

Cases live in `cases/` as `<case-id>.json` following the golden-set format in
`evals/quality/README.md`. Intentionally empty at skeleton stage.
