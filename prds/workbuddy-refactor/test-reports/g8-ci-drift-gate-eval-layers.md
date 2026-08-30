# G8: --ci Drift Gate + Eval L2/L3/L4 Layers — Test Report

## Summary

Fixed the `--ci` i18n drift gate to fail on missing keys, added L3 consistency layer spec skeleton, and verified L2/L4 layer status.

## Changes

### 1. `--ci` Drift Gate Fix (`scripts/i18n-audit.mjs`)

**Before**: The `--ci` flag explicitly suppressed failures for missing non-en keys (`if (!isCi) exitCode = 1`), allowing i18n drift to accumulate silently.

**After**: Missing keys always cause failure (`exitCode = 1`), making `--ci` a proper drift gate. The CI workflow (`ci-i18n.yml`) now fails on any i18n drift.

**Verification**: `node scripts/i18n-audit.mjs --ci` passes with exit code 0 (all 9 locales at 100% key coverage, no orphans, no duplicates).

### 2. L3 Consistency Layer (`evals/specs/l3-relay-sync-faults.test.ts`)

Created 5-test spec skeleton for Relay Sync fault injection:

| Test | Status | Gate |
|------|--------|------|
| L3 fault proxy — status injection | Skipped | `OPENWORK_EVAL_L3_FAULTS` |
| L3 fault proxy — latency injection | Skipped | `OPENWORK_EVAL_L3_FAULTS` |
| L3 relay sync — disconnect consistency | Skipped | `OPENWORK_EVAL_L3_FAULTS` + `OPENWORK_EVAL_APP_SPECS` |
| L3 relay sync — cloud handoff under fault | Skipped | `OPENWORK_EVAL_L3_FAULTS` + `OPENWORK_EVAL_APP_SPECS` |
| L3 relay sync — concurrent write merge | Skipped | `OPENWORK_EVAL_L3_FAULTS` + `OPENWORK_EVAL_APP_SPECS` |

All tests properly gated behind opt-in env vars. Full Relay Sync fault scenarios land with phase four.

**Vitest result**: 1 file passed, 5 tests skipped (correct behavior for opt-in gates).

### 3. L2 Quality Layer (Already Present)

- `i18n-completeness` domain: wired with golden + deterministic judge
- `expert-orchestration` domain: wired with golden + deterministic judge
- `doc-artifacts` domain: placeholder (phase three)
- `voice-transcription` domain: placeholder (phase three)
- The `--ci` drift gate fix ensures i18n drift is now caught in CI via `ci-i18n.yml`

### 4. L4 Smoke Layer (Already Present)

- `daily-journey.slow.test.ts`: steps 1/2/5 wired, 3/4 TODO skip (phase four)
- `daily-smoke.yml`: cron `0 0 * * *` daily run
- No changes needed — TODO skips are properly documented

## Test Results

### i18n Audit with --ci
```
node scripts/i18n-audit.mjs --ci
All 9 locales: ✓ no missing, ✓ no orphans, ✓ no duplicates
Exit code: 0
```

### L3 Spec
```
npx vitest run --project pr specs/l3-relay-sync-faults.test.ts
1 file passed, 5 tests skipped
```

### CI Integration
- `ci-i18n.yml`: runs `node scripts/i18n-audit.mjs --ci` — now fails on drift
- `ci-tests.yml`: runs `pnpm --dir evals run spec` — includes L3 spec (properly skipped)

## Status: PASSED

## Eval Layer Summary

| Layer | Question | Status |
|-------|----------|--------|
| L1 (规格层) | Does app behavior match the approved script? | Landed; extends per-phase PR |
| L2 (质量层) | Is content up to standard? | Skeleton landed; 2/4 domains wired; drift gate fixed |
| L3 (一致性层) | State consistency under fault injection? | Foundation spec landed; full scenarios phase four |
| L4 (冒烟层) | Daily end-to-end journey? | Partial: steps 1/2/5 wired, 3/4 TODO phase four |