/**
 * L2 quality layer — judge contracts.
 *
 * A golden case declares exactly one grading mode (never mix modes inside one
 * case):
 *
 * - `deterministic` — structured output is compared against the case's
 *   `expected` spec by `judgeAgainstExpected` (exact / shape / keys /
 *   invariants). Zero variance, no model calls. See deterministic-judge.ts.
 * - `llm-judge` — open-ended output is graded against a rubric by an LLM judge
 *   with a pinned seed and a versioned prompt. The LLM client is injected, so
 *   tests run against a mock and real runs switch clients via env. See
 *   llm-judge.ts.
 *
 * Roadmap anchor: prds/workbuddy-refactor/roadmap.md §评测体系 (L2 质量层).
 */

export type GoldenMode = "deterministic" | "llm-judge";

export interface GoldenCase {
  /** Stable case id: "<domain>.<slug>-NNN". */
  id: string;
  domain: string;
  title?: string;
  input: Record<string, unknown>;
  grading: GoldenGrading;
  metadata?: Record<string, unknown>;
}

export type FieldKind =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "null"
  | "any";

/** What a deterministic case expects the actual output to look like. */
export type ExpectedSpec =
  | { type: "exact"; value: unknown }
  | { type: "shape"; required?: string[]; fields?: Record<string, FieldKind> }
  | { type: "keys"; contains?: string[]; excludes?: string[] }
  | {
      type: "invariants";
      /** Names that must all be present in `actual.invariants[]` with `passed: true`. */
      required: string[];
    };

export interface RubricCriterion {
  criterion: string;
  /** Defaults to 1 when omitted. */
  weight?: number;
  /** Required criteria must score 1 or the verdict fails regardless of the weighted score. */
  required?: boolean;
}

export type GoldenGrading =
  | {
      mode: "deterministic";
      expected: ExpectedSpec;
      /** "fail" turns measured drift into a failed verdict; "report" records it but passes. */
      driftPolicy?: "fail" | "report";
    }
  | {
      mode: "llm-judge";
      rubric: RubricCriterion[];
      /** Pinned seed keeps judge runs reproducible across client and date. */
      seed?: string;
      /** Weighted score (0..1) that the case must clear. */
      passThreshold: number;
      judgeModel?: string;
      judgePromptVersion?: string;
    };

export interface Verdict {
  passed: boolean;
  /** Human-readable reasons; at least one entry per failed check. */
  reasons: string[];
  /** Optional structured detail (drift stats, per-criterion scores, ...). */
  detail?: unknown;
}

export interface CaseResult {
  caseId: string;
  domain: string;
  mode: GoldenMode;
  verdict: Verdict;
  durationMs: number;
  /** Present when the case was intentionally not executed (e.g. TODO placeholder). */
  skipped?: string;
}
