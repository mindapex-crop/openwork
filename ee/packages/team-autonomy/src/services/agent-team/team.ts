// Agent team creation and execution strategies.
// Provides factory functions for creating and running multi-agent teams.

import type {
  AgentTeamConfig,
  FanOutInput,
  FanOutResult,
  FanOutAssignment,
  FanOutSynthesisInput,
} from "./types.js"
import { Supervisor } from "./supervisor.js"
import { executeRelayPipeline, type RelayStep } from "./relay.js"

export type AgentTeam = {
  config: AgentTeamConfig
  supervisor: Supervisor
  fanOut: (executor: AgentExecutor) => Promise<FanOutResult[]>
  fanOutWithSynthesis: (executor: AgentExecutor, synthesizer: AgentSynthesizer) => Promise<{
    results: FanOutResult[]
    synthesis: string
  }>
  relayChain: (steps: RelayStep[], executor: AgentExecutor) => Promise<{
    results: FanOutResult[]
    finalOutput: string
  }>
  broadcastToAll: (message: string, executor: AgentExecutor) => Promise<FanOutResult[]>
}

export type AgentExecutor = (assignment: FanOutAssignment) => Promise<FanOutResult>

export type AgentSynthesizer = (input: FanOutSynthesisInput) => Promise<string>

/**
 * Creates an agent team from the given configuration.
 * The team uses a Supervisor to decompose tasks and coordinate execution.
 */
export function createAgentTeam(config: AgentTeamConfig): AgentTeam {
  const supervisor = new Supervisor()

  return {
    config,
    supervisor,

    async fanOut(executor: AgentExecutor): Promise<FanOutResult[]> {
      const tasks = supervisor.decompose(config)
      const review = supervisor.review(tasks)
      if (!review.approved || !review.revisedTasks) {
        return tasks.map((t) => ({
          agentId: t.agentId,
          status: "failed" as const,
          error: review.reason ?? "Task review failed",
        }))
      }
      const assignments = supervisor.coordinate(review.revisedTasks)
      return Promise.all(assignments.map((a) => executor(a)))
    },

    async fanOutWithSynthesis(
      executor: AgentExecutor,
      synthesizer: AgentSynthesizer,
    ): Promise<{ results: FanOutResult[]; synthesis: string }> {
      const results = await this.fanOut(executor)
      const synthesis = await synthesizer({ config, results })
      return { results, synthesis }
    },

    async relayChain(
      steps: RelayStep[],
      executor: AgentExecutor,
    ): Promise<{ results: FanOutResult[]; finalOutput: string }> {
      const pipeline = await executeRelayPipeline(steps, async (step, prev) => {
        return executor({ agentId: step.agentId, task: `${step.task}\n\nPrevious output: ${prev ?? "none"}` })
      })

      const results: FanOutResult[] = pipeline.steps.map((s) => ({
        agentId: s.agentId,
        status: s.status === "completed" ? "completed" : "failed",
        output: s.output,
        error: s.error,
      }))

      return { results, finalOutput: pipeline.finalOutput }
    },

    async broadcastToAll(message: string, executor: AgentExecutor): Promise<FanOutResult[]> {
      const assignments: FanOutAssignment[] = config.memberIds.map((agentId) => ({
        agentId,
        task: message,
      }))
      return Promise.all(assignments.map((a) => executor(a)))
    },
  }
}
