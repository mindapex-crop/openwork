import { expect } from "vitest";
import { test } from "@openwork/testkit";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import {
  scanGoldenCases,
  runQualitySuite,
  runCase,
  GOLDEN_DIR,
} from "./run.ts";
import {
  judgeAgainstExpected,
  judgeDeterministicCase,
  deepEqual,
} from "./deterministic-judge.ts";
import {
  createMockLlmClient,
  buildJudgePrompt,
  judgeWithLlm,
  parseJudgeReply,
} from "./llm-judge.ts";
import { collectFlatKeys, diffKeys } from "./scanners/i18n-scanner.ts";
import type { GoldenCase } from "./judge.ts";

test("scanGoldenCases discovers the shipped i18n and expert-orchestration golden cases", async ({ evidence }) => {
  const cases = scanGoldenCases(GOLDEN_DIR);
  const ids = cases.map((caseDef) => caseDef.id);
  expect(ids).toContain("i18n-completeness.ship-locale-keys-001");
  expect(ids).toContain("expert-orchestration.capability-match-001");
  expect(ids).toContain("expert-orchestration.primary-with-fallback-001");
  expect(ids).toContain("expert-orchestration.strategy-balanced-001");
  expect(cases.length).toBeGreaterThanOrEqual(4);
  evidence.fact(
    "Golden cases are discoverable from the golden dir",
    `scanGoldenCases found ${cases.length} cases across ${new Set(cases.map((c) => c.domain)).size} domains.`,
    true,
  );
});

test("the whole golden suite passes: i18n invariants hold and expert orchestration matches expected structure", async ({ evidence }) => {
  const testOutDir = join(tmpdir(), `openwork-quality-run-${Date.now()}`);
  const report = await runQualitySuite(GOLDEN_DIR, { outDir: testOutDir });
  rmSync(testOutDir, { recursive: true, force: true });
  expect(report.summary.failed).toBe(0);
  expect(report.summary.skipped).toBe(0);
  expect(report.summary.total).toBeGreaterThanOrEqual(4);
  for (const result of report.results) {
    expect(result.verdict.passed, `${result.caseId}: ${result.verdict.reasons.join("; ")}`).toBe(true);
  }
  const i18n = report.results.find((result) => result.caseId.startsWith("i18n-completeness."));
  expect(i18n).toBeDefined();
  const detail = i18n!.verdict.detail;
  const detailText = detail === undefined ? "no structured detail" : JSON.stringify(detail).slice(0, 200);
  evidence.fact(
    "L2 runner executes every golden case green against the current codebase",
    `total=${report.summary.total}, passed=${report.summary.passed}, failed=${report.summary.failed}, skipped=${report.summary.skipped}. ` +
      `i18n drift is recorded in the report (${detailText}) but does not fail the case.`,
    true,
  );
});

test("judgeAgainstExpected supports exact, shape, keys, and invariants specs", async ({ evidence }) => {
  expect(judgeAgainstExpected({ a: 1, b: [1, 2] }, { type: "exact", value: { a: 1, b: [1, 2] } }).passed).toBe(true);
  expect(judgeAgainstExpected({ a: 1 }, { type: "exact", value: { a: 2 } }).passed).toBe(false);

  expect(judgeAgainstExpected({ a: "x", b: 1 }, { type: "shape", required: ["a", "b"], fields: { a: "string", b: "number" } }).passed).toBe(true);
  expect(judgeAgainstExpected({ a: "x" }, { type: "shape", required: ["a", "b"] }).passed).toBe(false);
  expect(judgeAgainstExpected({ a: 1 }, { type: "shape", fields: { a: "string" } }).passed).toBe(false);

  expect(judgeAgainstExpected({ x: 1, y: 2 }, { type: "keys", contains: ["x", "y"], excludes: ["z"] }).passed).toBe(true);
  expect(judgeAgainstExpected(["x"], { type: "keys", contains: ["x", "y"] }).passed).toBe(false);

  expect(judgeAgainstExpected(
    { invariants: [{ name: "a", passed: true }, { name: "b", passed: true }] },
    { type: "invariants", required: ["a", "b"] },
  ).passed).toBe(true);
  expect(judgeAgainstExpected(
    { invariants: [{ name: "a", passed: false, detail: "boom" }] },
    { type: "invariants", required: ["a"] },
  ).passed).toBe(false);

  expect(deepEqual({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
  expect(deepEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
  evidence.fact(
    "Deterministic judge covers all four expected-spec kinds",
    "exact/shape/keys/invariants each pass and fail on the right inputs; deepEqual is order-sensitive for arrays.",
    true,
  );
});

test("judgeDeterministicCase enforces driftPolicy=fail", async ({ evidence }) => {
  const caseDef: GoldenCase = {
    id: "test.drift-001",
    domain: "test",
    input: {},
    grading: { mode: "deterministic", expected: { type: "invariants", required: [] }, driftPolicy: "fail" },
  };
  expect(judgeDeterministicCase(caseDef, { invariants: [], drift: { totalMissingKeys: 0, totalExtraKeys: 0 } }).passed).toBe(true);
  expect(judgeDeterministicCase(caseDef, { invariants: [], drift: { totalMissingKeys: 3, totalExtraKeys: 0 } }).passed).toBe(false);
  evidence.fact(
    "driftPolicy gates deterministic verdicts",
    "With driftPolicy=fail a non-zero drift total fails the case; a zero drift passes.",
    true,
  );
});

test("the LLM judge builds a seeded rubric prompt and parses mock replies", async ({ evidence }) => {
  const caseDef: GoldenCase = {
    id: "test.llm-001",
    domain: "test",
    input: { output: { summary: "hello world" } },
    grading: {
      mode: "llm-judge",
      rubric: [
        { criterion: "factual", weight: 2, required: true },
        { criterion: "concise", weight: 1 },
      ],
      seed: "golden-seed",
      passThreshold: 0.7,
      judgePromptVersion: "v1",
    },
  };
  const prompt = buildJudgePrompt(caseDef, caseDef.input.output);
  expect(prompt).toContain("factual (weight 2) [REQUIRED]");
  expect(prompt).toContain("Seed: golden-seed");
  expect(prompt).toContain('"summary"');

  const passing = await judgeWithLlm(caseDef, caseDef.input.output, createMockLlmClient(
    '{"scores": {"factual": 1, "concise": 1}, "comment": "ok"}',
  ));
  expect(passing.passed).toBe(true);

  const failing = await judgeWithLlm(caseDef, caseDef.input.output, createMockLlmClient(
    '{"scores": {"factual": 0, "concise": 1}, "comment": "not factual"}',
  ));
  expect(failing.passed).toBe(false);
  expect(failing.reasons.some((reason) => reason.includes("required criterion"))).toBe(true);

  expect(parseJudgeReply('```json\n{"scores":{"factual":true},"comment":"x"}\n```').scores.factual).toBe(1);
  evidence.fact(
    "LLM judge is injectable and deterministic against a mock client",
    "A mock client that meets all required criteria passes; one that misses a required criterion fails with a clear reason.",
    true,
  );
});

test("the i18n scanner flattens and diffs message keys deterministically", async ({ evidence }) => {
  const keys = collectFlatKeys({ app: { error: { auth: "x" }, reload_now: "y" }, "settings.title": "z" });
  expect(keys).toEqual(["app.error.auth", "app.reload_now", "settings.title"]);
  const diff = diffKeys(["a.b", "a.c"], ["a.c", "a.d"]);
  expect(diff.missingKeys).toEqual(["a.b"]);
  expect(diff.extraKeys).toEqual(["a.d"]);
  evidence.fact(
    "Scanner primitives are deterministic",
    "collectFlatKeys flattens nested trees to sorted dotted keys; diffKeys is directional and stable.",
    true,
  );
});

test("runCase executes the expert orchestration runner against the real product dispatch function", async ({ evidence }) => {
  const caseDef: GoldenCase = {
    id: "expert-orchestration.capability-match-001",
    domain: "expert-orchestration",
    input: {
      dispatchPolicy: { kind: "capability-match", required: { streaming: true, permissions: true } },
      members: [
        { agentId: "coder", capabilities: { streaming: true, permissions: false } },
        { agentId: "writer", capabilities: { streaming: true, permissions: true } },
      ],
    },
    grading: { mode: "deterministic", expected: { type: "exact", value: { policyKind: "capability-match", selectedAgentId: "writer", eligibleAgents: ["writer"] } } },
  };
  const result = await runCase(caseDef);
  expect(result.verdict.passed).toBe(true);
  evidence.fact(
    "Expert orchestration golden runs the product's selectMember",
    "capability-match dispatch selects the writer member whose capabilities cover the required set.",
    true,
  );
});
