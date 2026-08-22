import { readDenSettings } from "@/app/lib/den";

/**
 * One unit of work assigned to a single AI agent by the orchestrator
 * (POST /teams/run-simple). `agentId` is the agent's key, `prompt` is what the
 * agent was asked to do, and `status` tracks its lifecycle.
 */
export type CollabSubtask = {
  agentId: string;
  prompt: string;
  status: string;
};

/** The happy-path payload returned by POST /teams/run-simple. */
export type RunSimpleCollabResult = {
  teamId: string;
  taskId: string;
  strategy: string;
  status: string;
  message?: string;
  subtasks: CollabSubtask[];
};

export type CollabRunFailureKind = "no_agent_available" | "request";

/**
 * Discriminated outcome of a `runSimpleCollab` call. Consumers branch on
 * `ok` / `kind` instead of relying on thrown errors so the "no AI assistant
 * available" case can be rendered distinctly from a generic failure.
 */
export type RunSimpleCollabOutcome =
  | { ok: true; data: RunSimpleCollabResult }
  | { ok: false; kind: CollabRunFailureKind; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readSubtasks(value: unknown): CollabSubtask[] {
  if (!Array.isArray(value)) return [];
  const result: CollabSubtask[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const agentId = typeof item.agentId === "string" ? item.agentId : "";
    const prompt = typeof item.prompt === "string" ? item.prompt : "";
    const status = typeof item.status === "string" ? item.status : "pending";
    if (agentId || prompt) {
      result.push({ agentId, prompt, status });
    }
  }
  return result;
}

/**
 * Ask the orchestrator to form an AI team for a user prompt and return the
 * resulting plan. The base URL and auth headers come from the current Den
 * settings (same mechanism as the team panels).
 */
export async function runSimpleCollab(prompt: string): Promise<RunSimpleCollabOutcome> {
  const { baseUrl, authToken, activeOrgId } = readDenSettings();
  const url = `${baseUrl.replace(/\/+$/, "")}/teams/run-simple`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (activeOrgId) headers["x-openwork-legacy-org-id"] = activeOrgId;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ prompt }),
    });
  } catch (error) {
    return { ok: false, kind: "request", message: error instanceof Error ? error.message : String(error) };
  }

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const body = isRecord(json) ? json : {};
    const errorCode = typeof body.code === "string" ? body.code : "";
    const messageFromBody =
      (typeof body.message === "string" && body.message) ||
      (typeof body.error === "string" && body.error) ||
      `请求失败（${response.status}）`;
    if (errorCode === "no_agent_available" || messageFromBody.includes("no_agent_available")) {
      return { ok: false, kind: "no_agent_available", message: messageFromBody };
    }
    return { ok: false, kind: "request", message: messageFromBody };
  }

  const data = isRecord(json) ? json : {};
  return {
    ok: true,
    data: {
      teamId: typeof data.teamId === "string" ? data.teamId : "",
      taskId: typeof data.taskId === "string" ? data.taskId : "",
      strategy: typeof data.strategy === "string" ? data.strategy : "",
      status: typeof data.status === "string" ? data.status : "",
      subtasks: readSubtasks(data.subtasks),
      ...(typeof data.message === "string" ? { message: data.message } : {}),
    },
  };
}