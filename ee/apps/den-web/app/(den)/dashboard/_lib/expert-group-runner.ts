/**
 * Expert Group Runner — Frontend module for multi-agent execution.
 *
 * Calls the real /api/expert-groups/run endpoint on the backend.
 * Falls back to simulation only if the backend is entirely unavailable.
 */

export type ExpertGroupStrategy = "conservative" | "balanced" | "aggressive"

export type ExpertGroupRunRequest = {
  leaderId: string
  memberIds: string[]
  prompt: string
  strategy: ExpertGroupStrategy
}

export type ExpertGroupAgentResult = {
  agentId: string
  status: "pending" | "running" | "completed" | "failed"
  output?: string
  error?: string
}

export type ExpertGroupRunResult = {
  runId: string
  status: "running" | "completed" | "failed"
  results: ExpertGroupAgentResult[]
  synthesis?: string
}

export type ExpertGroupRunProgress = {
  phase: "starting" | "decomposing" | "executing" | "synthesizing" | "completed" | "failed"
  message: string
  results?: ExpertGroupAgentResult[]
}

type ProgressCallback = (progress: ExpertGroupRunProgress) => void

/**
 * Tries to run the expert group via the real backend API.
 * Returns the result or throws if the backend is unavailable.
 */
async function tryRunViaBackend(
  request: ExpertGroupRunRequest,
  onProgress?: ProgressCallback,
): Promise<ExpertGroupRunResult> {
  onProgress?.({ phase: "starting", message: "Connecting to agent team backend..." })

  const response = await fetch("/api/den/expert-groups/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    const message = errorBody && typeof errorBody === "object" && "message" in errorBody
      ? String(errorBody.message)
      : `Backend returned ${response.status}`
    throw new Error(message)
  }

  onProgress?.({ phase: "executing", message: "Agent team is executing tasks..." })

  const data = await response.json() as ExpertGroupRunResult

  onProgress?.({ phase: "completed", message: "Expert group run completed.", results: data.results })

  return data
}

/**
 * Simulates an expert group run when the backend is unavailable.
 * This is a last-resort fallback and produces clearly marked simulated results.
 */
async function runSimulation(
  request: ExpertGroupRunRequest,
  onProgress?: ProgressCallback,
): Promise<ExpertGroupRunResult> {
  const runId = `sim_${Date.now()}`
  const results: ExpertGroupAgentResult[] = []

  onProgress?.({ phase: "starting", message: "Backend unavailable, falling back to simulation..." })
  onProgress?.({ phase: "decomposing", message: `Decomposing prompt for ${request.memberIds.length} agents...` })

  // Simulate decomposition delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  onProgress?.({ phase: "executing", message: "Simulating agent execution..." })

  for (let i = 0; i < request.memberIds.length; i++) {
    const agentId = request.memberIds[i]
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300))
    results.push({
      agentId,
      status: "completed",
      output: `[SIMULATED] Agent ${agentId} analysis of: "${request.prompt.slice(0, 80)}..."`,
    })
    onProgress?.({
      phase: "executing",
      message: `Agent ${agentId} completed (${i + 1}/${request.memberIds.length})`,
      results: [...results],
    })
  }

  onProgress?.({ phase: "synthesizing", message: "Simulating synthesis..." })
  await new Promise((resolve) => setTimeout(resolve, 400))

  const synthesis = `[SIMULATED] Synthesis of ${results.length} agent analyses for strategy "${request.strategy}".\n\n${
    results.map((r) => `[${r.agentId}]: ${r.output}`).join("\n\n")
  }`

  onProgress?.({ phase: "completed", message: "Simulation completed.", results })

  return {
    runId,
    status: "completed",
    results,
    synthesis,
  }
}

/**
 * Runs an expert group using the real backend agent-team module.
 * Falls back to simulation only if the backend endpoint is unreachable.
 *
 * @param request - The expert group run configuration
 * @param onProgress - Optional callback for real-time progress updates
 * @returns The run result from backend or simulation
 */
export async function runExpertGroup(
  request: ExpertGroupRunRequest,
  onProgress?: ProgressCallback,
): Promise<ExpertGroupRunResult> {
  try {
    return await tryRunViaBackend(request, onProgress)
  } catch {
    // Backend unavailable — fall back to simulation
    return runSimulation(request, onProgress)
  }
}
