import type { ApiClient } from "./client";
import type { Automation } from "../types";

export interface AutomationRecord {
  id: string;
  name: string;
  description: string;
  enabled: number;
  trigger: string;
  updated_at: number;
}

function toAutomation(record: AutomationRecord): Automation {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    enabled: record.enabled === 1,
    trigger: record.trigger,
    updatedAt: record.updated_at,
  };
}

export const automationsApi = {
  async list(client: ApiClient): Promise<Automation[]> {
    const result = await client.get<{ items: AutomationRecord[] }>("/api/automations");
    return (result.items ?? []).map(toAutomation);
  },

  async toggle(client: ApiClient, id: string, enabled: boolean): Promise<Automation> {
    const record = await client.post<AutomationRecord>(`/api/automations/${encodeURIComponent(id)}/toggle`, { enabled });
    return toAutomation(record);
  },

  async create(client: ApiClient, input: { name: string; description?: string; trigger?: string }): Promise<Automation> {
    const record = await client.post<AutomationRecord>("/api/automations", input);
    return toAutomation(record);
  },

  async remove(client: ApiClient, id: string): Promise<void> {
    await client.request("DELETE", `/api/automations/${encodeURIComponent(id)}`);
  },
};