/**
 * L2 quality layer runner.
 *
 * Scans the golden directory (evals/quality/golden/<domain>/{golden.json,
 * cases/*.json}), executes every case through its domain runner, judges the
 * actual output (deterministic comparison, or LLM judge with an injected
 * client), and emits a summary report as markdown + JSON.
 *
 * CLI:
 *   node quality/run.ts                      # run against the default golden dir
 *   node quality/run.ts --golden-dir <dir>   # run against another golden dir
 *   node quality/run.ts --out-dir <dir>      # write reports there
 *
 * Exit code 1 when any case fails.
 */
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CaseResult, GoldenCase } from "./judge.ts";
import { judgeDeterministicCase } from "./deterministic-judge.ts";
import {
  judgeWithLlm,
  createMockLlmClient,
  createHttpLlmClient,
  type LlmClient,
} from "./llm-judge.ts";
import { runI18nCompletenessCase } from "./runners/i18n-completeness.ts";
import { runExpertOrchestrationCase } from "./runners/expert-orchestration.ts";

export const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), "golden");
export const DEFAULT_OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "reports");

export interface QualityRunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface QualityRunReport {
  generatedAt: string;
  goldenDir: string;
  results: CaseResult[];
  summary: QualityRunSummary;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCase(raw: unknown, file: string): GoldenCase {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.domain !== "string") {
    throw new Error(`Golden case file ${file} must have string id and domain`);
  }
  if (!isRecord(raw.input) || !isRecord(raw.grading)) {
    throw new Error(`Golden case ${raw.id} must have input and grading objects`);
  }
  return raw as unknown as GoldenCase;
}

/** Collect every golden case under <goldenDir>/<domain>/{golden.json,cases/*.json}. */
export function scanGoldenCases(goldenDir: string): GoldenCase[] {
  const cases: GoldenCase[] = [];
  for (const entry of readdirSync(goldenDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const domainPath = join(goldenDir, entry.name);
    const files: string[] = [];
    const direct = join(domainPath, "golden.json");
    if (existsSync(direct)) files.push(direct);
    const casesDir = join(domainPath, "cases");
    if (existsSync(casesDir)) {
      for (const file of readdirSync(casesDir)) {
        if (file.endsWith(".json")) files.push(join(casesDir, file));
      }
    }
    for (const file of files) {
      const raw: unknown = JSON.parse(readFileSync(file, "utf-8"));
      cases.push(normalizeCase(raw, file));
    }
  }
  return cases.sort((a, b) => a.id.localeCompare(b.id));
}

function finish(caseDef: GoldenCase, verdict: CaseResult["verdict"], startedAt: number): CaseResult {
  return {
    caseId: caseDef.id,
    domain: caseDef.domain,
    mode: caseDef.grading.mode,
    verdict,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Execute a single golden case. Deterministic domains run their real runner and
 * judge the output; llm-judge cases read the output from `input.output` and
 * grade it with the injected client (a mock by default, real HTTP when
 * OPENWORK_EVAL_LLM_ENDPOINT is set and no client is injected).
 */
export async function runCase(caseDef: GoldenCase, llmClient?: LlmClient): Promise<CaseResult> {
  const startedAt = Date.now();
  switch (caseDef.domain) {
    case "i18n-completeness": {
      const actual = runI18nCompletenessCase(caseDef);
      const verdict = judgeDeterministicCase(caseDef, actual);
      return finish(caseDef, verdict, startedAt);
    }
    case "expert-orchestration": {
      const actual = await runExpertOrchestrationCase(caseDef);
      const verdict = judgeDeterministicCase(caseDef, actual);
      return finish(caseDef, verdict, startedAt);
    }
    case "doc-artifacts":
    case "voice-transcription":
      return {
        caseId: caseDef.id,
        domain: caseDef.domain,
        mode: caseDef.grading.mode,
        verdict: { passed: false, reasons: ["domain is a placeholder; cases not authored yet"] },
        durationMs: 0,
        skipped: "placeholder domain — cases not authored yet",
      };
    default:
      break;
  }

  // LLM-judge mode (any domain): the output under test comes from input.output.
  if (caseDef.grading.mode === "llm-judge") {
    if (!("output" in caseDef.input)) {
      return {
        caseId: caseDef.id,
        domain: caseDef.domain,
        mode: "llm-judge",
        verdict: { passed: false, reasons: ["no input.output provided for the LLM judge"] },
        durationMs: 0,
        skipped: "llm-judge cases need a produced output; skeleton stage has none",
      };
    }
    const client = llmClient ?? (process.env.OPENWORK_EVAL_LLM_ENDPOINT ? createHttpLlmClient() : createMockLlmClient());
    const verdict = await judgeWithLlm(caseDef, caseDef.input.output, client);
    return finish(caseDef, verdict, startedAt);
  }
  throw new Error(`No runner for domain ${caseDef.domain} (mode ${caseDef.grading.mode})`);
}

export function summarizeResults(results: CaseResult[]): QualityRunSummary {
  return {
    total: results.length,
    passed: results.filter((result) => result.verdict.passed).length,
    failed: results.filter((result) => !result.verdict.passed && !result.skipped).length,
    skipped: results.filter((result) => Boolean(result.skipped)).length,
  };
}

function emoji(status: "passed" | "failed" | "skipped"): string {
  if (status === "passed") return "✅";
  if (status === "failed") return "❌";
  return "⏭️";
}

export function renderMarkdown(report: QualityRunReport): string {
  const lines: string[] = [
    `# L2 Quality Report`,
    ``,
    `Generated at ${report.generatedAt} from ${report.goldenDir}`,
    ``,
    `| Status | Case | Domain | Mode | Verdict |`,
    `| --- | --- | --- | --- | --- |`,
  ];
  for (const result of report.results) {
    const status = result.skipped ? "skipped" : result.verdict.passed ? "passed" : "failed";
    const verdictText = result.skipped
      ?? result.verdict.reasons.join("; ").slice(0, 140);
    lines.push(
      `| ${emoji(status)} | ${result.caseId} | ${result.domain} | ${result.mode} | ${verdictText.replace(/\|/g, "\\|")} |`,
    );
  }
  lines.push(
    ``,
    `## Summary`,
    ``,
    `- total: ${report.summary.total}`,
    `- passed: ${report.summary.passed}`,
    `- failed: ${report.summary.failed}`,
    `- skipped: ${report.summary.skipped}`,
    ``,
    report.summary.failed > 0
      ? `Exit code will be 1: ${report.summary.failed} case(s) failed.`
      : `All executed cases passed.`,
    ``,
  );
  return lines.join("\n");
}

export interface RunQualityOptions {
  llmClient?: LlmClient;
  outDir?: string;
}

/** Run the whole golden suite and write latest.{json,md} into the report dir. */
export async function runQualitySuite(
  goldenDir = GOLDEN_DIR,
  options: RunQualityOptions = {},
): Promise<QualityRunReport> {
  const cases = scanGoldenCases(goldenDir);
  const results: CaseResult[] = [];
  for (const caseDef of cases) {
    results.push(await runCase(caseDef, options.llmClient));
  }
  const report: QualityRunReport = {
    generatedAt: new Date().toISOString(),
    goldenDir,
    results,
    summary: summarizeResults(results),
  };

  const outDir = options.outDir ?? DEFAULT_OUT_DIR;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(join(outDir, "latest.md"), renderMarkdown(report), "utf8");
  return report;
}

interface CliOptions {
  goldenDir: string;
  outDir: string | undefined;
}

function parseCliArgs(args: readonly string[]): CliOptions {
  let goldenDir = GOLDEN_DIR;
  let outDir: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) break;
    if (arg === "--golden-dir" || arg === "--out-dir") {
      const value = args[index + 1];
      if (value === undefined) throw new Error(`${arg} requires a value`);
      if (arg === "--golden-dir") goldenDir = resolve(value);
      else outDir = resolve(value);
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  return { goldenDir, outDir };
}

async function main(): Promise<number> {
  const { goldenDir, outDir } = parseCliArgs(process.argv.slice(2));
  const report = await runQualitySuite(goldenDir, { outDir });
  process.stdout.write(renderMarkdown(report));
  return report.summary.failed > 0 ? 1 : 0;
}

const invokedAsScript =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedAsScript) {
  process.exitCode = await main();
}
