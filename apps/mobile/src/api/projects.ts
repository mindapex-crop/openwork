import type { ApiClient } from "./client";
import type { Project } from "../types";

export interface WorkspaceResponse {
  id: string;
  name: string;
  path: string;
}

export const projectsApi = {
  async list(client: ApiClient): Promise<Project[]> {
    const result = await client.get<{ items: WorkspaceResponse[]; workspaces: WorkspaceResponse[] }>("/workspaces");
    const items = result.items ?? result.workspaces ?? [];
    return items.map((ws) => ({
      id: ws.id,
      name: ws.name,
      description: ws.path,
      status: "active" as const,
      updatedAt: Date.now(),
    }));
  },
};