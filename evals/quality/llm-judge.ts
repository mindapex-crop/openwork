/**
 * LLM judge for open-ended golden-case outputs.
 *
 * The judge prompt is built from the case's rubric (ordered criteria with
 * weight and required flags), the pinned seed, and the output under test. The
 * LLM client is injected so tests run against a mock and real runs switch
 * clients via env (see createHttpLlmClient / OPENWORK_EVAL_LLM_*).
 *
 * The judge replies with JSON:
 *   { "scores": { "<criterion>": 0 | 1 }, "comment": "…" }
 * A verdict passes when every `required` criterion scores 1 AND the weighted
 * score (0..1) clears the case's passThreshold.
 */
import type { GoldenCase, RubricCriterion, Verdict } from "./judge.ts";

export interface LlmClient {
  complete(prompt: string, options?: { model?: string; seed?: number }): Promise<string>;
}

export interface LlmJudgeOptions {
  client: LlmClient;
}

export function createMockLlmClient(
  reply: string = '{"scores": {},"comment":"mock judge"}',
): LlmClient {
  return {
    async complete(prompt, options) {
      void prompt;
      void options;
      return reply;
    },
  };
}

export function createHttpLlmClient(
  env: NodeJS.ProcessEnv = process.env,
): LlmClient {
  const endpoint = env.OPENWORK_EVAL_LLM_ENDPOINT?.trim();
  const apiKey = env.OPENWORK_EVAL_LLM_API_KEY?.trim();
  const defaultModel = env.OPENWORK_EVAL_LLM_MODEL?.trim() || "openai/gpt-4o-mini";
  return {
    async complete(prompt, options) {
      if (!endpoint) {
        throw new Error(
          "LLM judge client requires OPENWORK_EVAL_LLM_ENDPOINT; set it (plus OPENWORK_EVAL_LLM_API_KEY) or inject a mock client.",
        );
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: options?.model ?? defaultModel,
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
          ...(options?.seed !== undefined ? { seed: options.seed } : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(`LLM judge request failed: ${response.status} ${(await response.text()).slice(0, 240)}`);
      }
      const payload: unknown = await response.json();
      const content = isRecord(payload)
        ? isRecord(payload.choices) ? undefined
        : Array.isArray(payload.choices) ? (payload.choices[0] as Record<string, unknown> | undefined)?.message
        : undefined
        : undefined;
      const text = isRecord(content) && typeof content.content === "string" ? content.content : "";
      if (!text) throw new Error(`LLM judge returned no text content: ${JSON.stringify(payload).slice(0, 240)}`);
      return text;
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface JudgeReply {
  scores: Record<string, number>;
  comment: string;
}

function jsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) return fenced[1]!.trim();
  return text.trim();
}

/** Parse the judge's JSON reply, tolerating fenced code blocks and prose. */
export function parseJudgeReply(text: string): JudgeReply {
  const block = jsonBlock(text);
  const start = block.indexOf("{");
  const end = block.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`LLM judge reply was not JSON: ${text.slice(0, 200)}`);
  }
  const parsed: unknown = JSON.parse(block.slice(start, end + 1));
  if (!isRecord(parsed) || !isRecord(parsed.scores)) {
    throw new Error(`LLM judge reply missing "scores" object: ${text.slice(0, 200)}`);
  }
  const scores: Record<string, number> = {};
  for (const [criterion, score] of Object.entries(parsed.scores)) {
    scores[criterion] = score === 1 || score === true ? 1 : 0;
  }
  const comment = typeof parsed.comment === "string" ? parsed.comment : "";
  return { scores, comment };
}

/** Build the versioned judge prompt from the case rubric, seed, and output. */
export function buildJudgePrompt(caseDef: GoldenCase, output: unknown): string {
  if (caseDef.grading.mode !== "llm-judge") {
    throw new Error(`case ${caseDef.id} is not graded by an LLM judge`);
  }
  const { rubric, seed, judgePromptVersion = "v1" } = caseDef.grading;
  const rubricLines = rubric
    .map((criterion, index) => {
      const weight = criterion.weight ?? 1;
      const required = criterion.required === true ? " [REQUIRED]" : "";
      return `${index + 1}. ${criterion.criterion} (weight ${weight})${required}`;
    })
    .join("\n");
  const serialized = JSON.stringify(output, null, 2).slice(0, 20_000);
  return [
    `You are an evaluation judge for the golden case "${caseDef.id}".`,
    `Judge prompt version: ${judgePromptVersion}.`,
    `Seed: ${seed ?? "none"}.`,
    ``,
    `Grade the output against this rubric. Each criterion is scored 0 (not met) or 1 (met).`,
    rubricLines,
    ``,
    `A criterion marked [REQUIRED] MUST score 1.`,
    ``,
    `Output under test:`,
    `\`\`\`json`,
    serialized,
    `\`\`\``,
    ``,
    `Reply with ONLY JSON:`,
    `{"scores": {"<criterion text>": 0 or 1, ...}, "comment": "brief rationale"}`,
  ].join("\n");
}

/** Grade an open-ended output with the injected LLM client. */
export async function judgeWithLlm(
  caseDef: GoldenCase,
  output: unknown,
  client: LlmClient,
  options: LlmJudgeOptions = { client },
): Promise<Verdict> {
  const judge = options.client;
  if (caseDef.grading.mode !== "llm-judge") {
    return { passed: false, reasons: [`case ${caseDef.id} is not graded by an LLM judge`] };
  }
  const prompt = buildJudgePrompt(caseDef, output);
  const reply = await judge.complete(prompt, {
    model: caseDef.grading.judgeModel,
    seed: typeof caseDef.grading.seed === "string" ? stableSeed(caseDef.grading.seed) : undefined,
  });
  const parsed = parseJudgeReply(reply);

  const criteria: RubricCriterion[] = caseDef.grading.rubric;
  const reasons: string[] = [];
  let weightedSum = 0;
  let weightTotal = 0;
  for (const criterion of criteria) {
    const weight = criterion.weight ?? 1;
    const score = parsed.scores[criterion.criterion] ?? 0;
    weightedSum += score * weight;
    weightTotal += weight;
    if (criterion.required === true && score !== 1) {
      reasons.push(`required criterion not met: "${criterion.criterion}"`);
    }
  }
  const weighted = weightTotal > 0 ? weightedSum / weightTotal : 0;
  if (weighted < caseDef.grading.passThreshold) {
    reasons.push(
      `weighted score ${weighted.toFixed(2)} is below the pass threshold ${caseDef.grading.passThreshold}`,
    );
  }
  if (reasons.length === 0) {
    return {
      passed: true,
      reasons: [`all required criteria met; weighted score ${weighted.toFixed(2)} >= ${caseDef.grading.passThreshold}`],
      detail: { scores: parsed.scores, comment: parsed.comment },
    };
  }
  return {
    passed: false,
    reasons,
    detail: { scores: parsed.scores, comment: parsed.comment },
  };
}

/** Derive a numeric seed from a pinned seed string. */
export function stableSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}
