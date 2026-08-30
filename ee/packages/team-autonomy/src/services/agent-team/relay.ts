// Relay pipeline for chaining agent outputs.
// Each step receives the previous step's output as context.

import type { FanOutResult } from "./types.js"

export type RelayStep = {
  agentId: string
  task: string
}

export type RelayPipelineResult = {
  steps: Array<{
    agentId: string
    status: "completed" | "failed"
    output?: string
    error?: string
  }>
  finalOutput: string
}

/**
 * Executes a relay pipeline where each step processes the previous step's output.
 * Steps run sequentially; if any step fails, the pipeline stops.
 */
export async function executeRelayPipeline(
  steps: RelayStep[],
  executeStep: (step: RelayStep, previousOutput: string | undefined) => Promise<FanOutResult>,
): Promise<RelayPipelineResult> {
  const results: RelayPipelineResult["steps"] = []
  let previousOutput: string | undefined

  for (const step of steps) {
    const result = await executeStep(step, previousOutput)
    results.push({
      agentId: result.agentId,
      status: result.status === "completed" ? "completed" : "failed",
      output: result.output,
      error: result.error,
    })

    if (result.status !== "completed") {
      return {
        steps: results,
        finalOutput: previousOutput ?? "",
      }
    }

    previousOutput = result.output
  }

  return {
    steps: results,
    finalOutput: previousOutput ?? "",
  }
}
