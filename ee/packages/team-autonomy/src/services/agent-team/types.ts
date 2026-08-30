// Agent-team execution types for expert group multi-agent runs.

export type ExpertGroupStrategy = "conservative" | "balanced" | "aggressive"

export type AgentTeamConfig = {
  leaderId: string
  memberIds: string[]
  prompt: string
  strategy: ExpertGroupStrategy
}

export type FanOutInput = {
  config: AgentTeamConfig
  tasks: FanOutAssignment[]
}

export type FanOutAssignment = {
  agentId: string
  task: string
}

export type FanOutResult = {
  agentId: string
  status: "pending" | "running" | "completed" | "failed"
  output?: string
  error?: string
}

export type FanOutSynthesisInput = {
  config: AgentTeamConfig
  results: FanOutResult[]
}

export type ExpertGroupRunRequest = {
  leaderId: string
  memberIds: string[]
  prompt: string
  strategy: ExpertGroupStrategy
}

export type ExpertGroupRunResponse = {
  runId: string
  status: "running" | "completed" | "failed"
  results: FanOutResult[]
  synthesis?: string
}

export type ExpertGroupRunStatus = {
  runId: string
  status: "running" | "completed" | "failed"
  results: FanOutResult[]
  synthesis?: string
}
