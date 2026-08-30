// Supervisor for decomposing expert group prompts and coordinating agent execution.

import type { AgentTeamConfig, ExpertGroupStrategy, FanOutAssignment } from "./types.js"

export type DecomposedTask = {
  agentId: string
  subPrompt: string
  priority: number
}

export type SupervisorReview = {
  approved: boolean
  reason?: string
  revisedTasks?: DecomposedTask[]
}

/**
 * Supervisor handles task decomposition and review for expert groups.
 * The leader agent acts as the supervisor, decomposing complex prompts
 * into sub-tasks for each member agent.
 */
export class Supervisor {
  /**
   * Decomposes a complex prompt into per-agent sub-tasks based on strategy.
   */
  decompose(config: AgentTeamConfig): DecomposedTask[] {
    const { memberIds, prompt, strategy } = config
    const tasks: DecomposedTask[] = []

    const prefixes: Record<ExpertGroupStrategy, string> = {
      conservative: "Analyze conservatively: ",
      balanced: "Analyze from your perspective: ",
      aggressive: "Challenge and analyze aggressively: ",
    }

    const prefix = prefixes[strategy] ?? prefixes.balanced

    for (const agentId of memberIds) {
      tasks.push({
        agentId,
        subPrompt: `${prefix}${prompt}`,
        priority: 0,
      })
    }

    return tasks
  }

  /**
   * Reviews decomposed tasks and can modify or reject them.
   */
  review(tasks: DecomposedTask[]): SupervisorReview {
    if (tasks.length === 0) {
      return { approved: false, reason: "No tasks to review" }
    }
    return { approved: true }
  }

  /**
   * Coordinates the fan-out assignments from decomposed tasks.
   */
  coordinate(tasks: DecomposedTask[]): FanOutAssignment[] {
    return tasks.map((task) => ({
      agentId: task.agentId,
      task: task.subPrompt,
    }))
  }
}
