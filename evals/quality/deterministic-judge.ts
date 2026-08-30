/**
 * Deterministic judgment for structured golden-case outputs.
 *
 * The actual output produced by a domain runner is checked against the case's
 * `expected` spec without any model in the loop. Supported specs:
 *
 * - `exact` — deep equality against a literal value.
 * - `shape` — required top-level fields exist and optional field kinds match.
 * - `keys` — a key list must contain everything in `contains` and nothing in
 *   `excludes` (works on object keys or arrays of strings).
 * - `invariants` — `actual.invariants` is an array of `{ name, passed, detail }`
 *   entries; every name in `required` must have `passed: true`.
 */
import type { ExpectedSpec, FieldKind, GoldenCase, Verdict } from "./judge.ts";

const ok = (reasons: string[] = ["all expected checks passed"]): Verdict => ({
  passed: true,
  reasons,
});

const fail = (reasons: string[]): Verdict => ({ passed: false, reasons });

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((entry, index) => deepEqual(entry, b[index]));
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
  }
  return false;
}

function matchesFieldKind(value: unknown, kind: FieldKind): boolean {
  switch (kind) {
    case "string": return typeof value === "string";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "boolean": return typeof value === "boolean";
    case "array": return Array.isArray(value);
    case "object": return typeof value === "object" && value !== null && !Array.isArray(value);
    case "null": return value === null;
    case "any": return true;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Check an actual output against an expected spec. Pure and deterministic. */
export function judgeAgainstExpected(actual: unknown, expected: ExpectedSpec): Verdict {
  switch (expected.type) {
    case "exact": {
      return deepEqual(actual, expected.value)
        ? ok([`actual output deep-equals the expected literal`])
        : fail([`actual output does not deep-equal the expected literal (got ${JSON.stringify(actual).slice(0, 400)})`]);
    }

    case "shape": {
      if (!isRecord(actual)) return fail([`actual output is not an object (got ${typeof actual})`]);
      const reasons: string[] = [];
      for (const field of expected.required ?? []) {
        if (!(field in actual)) reasons.push(`missing required field "${field}"`);
      }
      for (const [field, kind] of Object.entries(expected.fields ?? {})) {
        if (field in actual && !matchesFieldKind(actual[field], kind)) {
          reasons.push(`field "${field}" should be ${kind}, got ${typeof actual[field]}`);
        }
      }
      return reasons.length === 0 ? ok(["shape checks passed"]) : fail(reasons);
    }

    case "keys": {
      const keys = isRecord(actual) ? Object.keys(actual) : Array.isArray(actual) ? actual : null;
      if (keys === null) return fail([`actual output is neither an object nor an array of keys (got ${typeof actual})`]);
      const reasons: string[] = [];
      for (const key of expected.contains ?? []) {
        if (!keys.includes(key)) reasons.push(`expected key "${key}" is missing`);
      }
      for (const key of expected.excludes ?? []) {
        if (keys.includes(key)) reasons.push(`unexpected key "${key}" is present`);
      }
      return reasons.length === 0 ? ok(["key-set checks passed"]) : fail(reasons);
    }

    case "invariants": {
      if (!isRecord(actual) || !Array.isArray(actual.invariants)) {
        return fail([`actual output is missing the "invariants" array (got ${JSON.stringify(actual).slice(0, 200)})`]);
      }
      const byName = new Map(
        (actual.invariants as Array<Record<string, unknown>>).map((entry) => [String(entry.name), entry]),
      );
      const reasons: string[] = [];
      for (const name of expected.required) {
        const entry = byName.get(name);
        if (!entry) reasons.push(`invariant "${name}" was not reported`);
        else if (entry.passed !== true) {
          const detail = typeof entry.detail === "string" ? `: ${entry.detail}` : "";
          reasons.push(`invariant "${name}" failed${detail}`);
        }
      }
      return reasons.length === 0 ? ok(["all required invariants passed"]) : fail(reasons);
    }
  }
}

/**
 * Deterministic verdict for a whole case: the expected-spec check plus the
 * optional `driftPolicy` gate ("fail" fails the case when the runner reports
 * drift; "report" records it but still passes).
 */
export function judgeDeterministicCase(caseDef: GoldenCase, actual: unknown): Verdict {
  if (caseDef.grading.mode !== "deterministic") {
    return fail([`case ${caseDef.id} is not graded deterministically`]);
  }
  const verdict = judgeAgainstExpected(actual, caseDef.grading.expected);
  if (!verdict.passed) return verdict;

  const driftPolicy = caseDef.grading.driftPolicy ?? "report";
  const drift = isRecord(actual)
    ? isRecord(actual.drift) ? actual.drift : null
    : null;
  const driftTotal = drift
    ? Number(drift.totalMissing ?? drift.totalMissingKeys ?? 0) + Number(drift.totalExtra ?? drift.totalExtraKeys ?? 0)
    : 0;
  if (driftPolicy === "fail" && driftTotal > 0) {
    return fail([`driftPolicy is "fail" but the runner measured ${driftTotal} drifting keys`]);
  }
  if (driftPolicy === "fail" && drift === null) {
    return fail([`driftPolicy is "fail" but the actual output does not report drift stats`]);
  }
  return verdict;
}
