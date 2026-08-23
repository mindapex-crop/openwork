# Domain: i18n-completeness

Translation **coverage** quality: every locale must expose exactly the key set
of the `"en"` baseline (no missing keys, no stray keys). This domain is fully
deterministic and is already runnable — no golden cases needed, the source of
truth is `apps/app/src/i18n/locales/*.ts` itself.

- Scanner: `evals/quality/i18n-completeness/scan.ts` (run via
  `pnpm quality:i18n-scan` from `evals/`; see `evals/quality/README.md`).
- Spec: `evals/specs/i18n-completeness.test.ts` (vitest `pr` project).
- The current per-locale missing/extra key lists produced by the scanner are
  the worklist for the i18n refactor; the scanner becomes a CI gate once the
  drift is burned down.

Future cases in `cases/` (empty at skeleton stage) would cover translation
*quality* (not just coverage) and would follow the golden-set format in
`evals/quality/README.md`, graded `llm-judge` with a rubric.
