import type { ApiClient } from "./client";

export interface AgentCapability {
  agentId: string;
  name: string;
  available: boolean;
}

export interface AgentModel {
  id: string;
  name?: string;
  provider?: string;
}

export const modelsApi = {
  async listAgents(client: ApiClient): Promise<AgentCapability[]> {
    const result = await client.get<{ capabilities: AgentCapability[] }>("/agent-runtimes");
    return result.capabilities ?? [];
  },

  async listModels(client: ApiClient, agentId: string): Promise<AgentModel[]> {
    const result = await client.get<{ models: AgentModel[]; count: number }>(
      `/agent-runtimes/${encodeURIComponent(agentId)}/models`,
    );
    return result.models ?? [];
  },
};