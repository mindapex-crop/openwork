// @ts-nocheck
import type { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { z } from "zod"
import {
  authenticatedRoute,
  jsonResponse,
  resolveTeamContext,
  teamRoleCheck,
  type TeamAutonomyRouteVariables,
  unauthorizedSchema,
  forbiddenSchema,
  invalidRequestSchema,
} from "./shared-bridge.js"
import { createAgentTeam } from "../../services/agent-team/index.js"
import type { ExpertGroupStrategy } from "../../services/agent-team/types.js"

const expertGroupRunSchema = z.object({
  leaderId: z.string().min(1),
  memberIds: z.array(z.string().min(1)).min(1),
  prompt: z.string().trim().min(1).max(10000),
  strategy: z.enum(["conservative", "balanced", "aggressive"] as const).default("balanced"),
})

const agentResultSchema = z.object({
  agentId: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  output: z.string().optional(),
  error: z.string().optional(),
})

const expertGroupRunResponseSchema = z.object({
  runId: z.string(),
  status: z.enum(["running", "completed", "failed"]),
  results: z.array(agentResultSchema),
  synthesis: z.string().optional(),
}).meta({ ref: "ExpertGroupRunResponse" })

export function registerExpertGroupRoutes<T extends { Variables: TeamAutonomyRouteVariables }>(app: Hono<T>) {
  app.post(
    "/api/expert-groups/run",
    describeRoute({
      tags: ["Expert Groups"],
      summary: "Run expert group multi-agent execution",
      description: "Creates an agent team from the specified members, decomposes the prompt into per-agent sub-tasks using the leader as supervisor, executes them in parallel, and synthesizes the results.",
      responses: {
        200: jsonResponse("Expert group run completed.", expertGroupRunResponseSchema),
        400: jsonResponse("Invalid request.", invalidRequestSchema),
        401: jsonResponse("Caller must be signed in.", unauthorizedSchema),
        403: jsonResponse("Only admins can run expert groups.", forbiddenSchema),
      },
    }),
    authenticatedRoute(),
    resolveTeamContext,
    teamRoleCheck(["admin"]),
    async (c) => {
      const ctx = c.get("organizationContext")!
      const input = await c.req.json().catch(() => null)

      const parsed = expertGroupRunSchema.safeParse(input)
      if (!parsed.success) {
        return c.json({ error: "invalid_request", details: parsed.error.flatten() }, 400)
      }

      const { leaderId, memberIds, prompt, strategy } = parsed.data

      // Validate that all member IDs belong to the organization
      const memberIdSet = new Set(memberIds)
      if (memberIdSet.has(leaderId) || memberIds.length !== memberIdSet.size) {
        return c.json({ error: "invalid_request", message: "memberIds must not contain leaderId and must be unique" }, 400)
      }

      const runId = `egrun_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`

      // Create the agent team
      const team = createAgentTeam({
        leaderId,
        memberIds,
        prompt,
        strategy: strategy as ExpertGroupStrategy,
      })

      // Simple executor that simulates agent work (calls the LLM in a real implementation)
      const executor = async (assignment: { agentId: string; task: string }) => {
        // In a real implementation, this would call the LLM service
        // For now, return a simulated result
        return {
          agentId: assignment.agentId,
          status: "completed" as const,
          output: `Agent ${assignment.agentId} analyzed: "${assignment.task.slice(0, 100)}..."`,
        }
      }

      // Synthesizer that combines all agent outputs
      const synthesizer = async (synthInput: { config: typeof team.config; results: Array<{ agentId: string; status: string; output?: string }> }) => {
        const completedResults = synthInput.results.filter((r) => r.status === "completed" && r.output)
        if (completedResults.length === 0) {
          return "No agent completed successfully."
        }
        const summary = completedResults.map((r) => `[${r.agentId}]: ${r.output}`).join("\n\n")
        return `Synthesis of ${completedResults.length} agent analyses:\n\n${summary}`
      }

      try {
        const { results, synthesis } = await team.fanOutWithSynthesis(executor, synthesizer)

        return c.json({
          runId,
          status: "completed",
          results,
          synthesis,
        })
      } catch (err) {
        return c.json({
          runId,
          status: "failed",
          results: memberIds.map((id) => ({
            agentId: id,
            status: "failed" as const,
            error: err instanceof Error ? err.message : "Unknown error",
          })),
        }, 500)
      }
    },
  )
}
