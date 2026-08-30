/**
 * 专家组执行器（真实实现）。
 *
 * 将专家组任务提交到后端 `/teams/run-simple` 编排接口（复用 agent-team 内核，
 * 由 `detectAllAgents` 探测本机可用的 CLI agent 后真实并行执行），并将返回的
 * 子任务结果映射回专家组视图（组长 + 成员）。不再包含任何本地模拟回退。
 */

import { resolveOpenworkConnection } from "@/react-app/shell/openwork-connection";

import type {
  ExpertGroup,
  ExpertGroupMemberResult,
  ExpertGroupResult,
} from "./expert-group-types";

export type ExpertGroupRunnerCallbacks = {
  onMemberUpdate?: (expertId: string, result: ExpertGroupMemberResult) => void;
  onComplete?: (result: ExpertGroupResult) => void;
};

const STORAGE_KEY = "openwork.expert-group-results";

function loadResults(): ExpertGroupResult[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveResults(results: ExpertGroupResult[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
  } catch {
    // 静默失败
  }
}

/** 持久化执行结果，返回完整记录。 */
export function persistResult(result: ExpertGroupResult): ExpertGroupResult {
  const all = loadResults();
  const next = [result, ...all].slice(0, 50); // 保留最近 50 条
  saveResults(next);
  return result;
}

export function listResults(groupId?: string): ExpertGroupResult[] {
  const all = loadResults();
  return groupId ? all.filter((r) => r.groupId === groupId) : all;
}

interface RunSimpleSubtaskResult {
  subtaskId: string;
  agentId: string;
  prompt: string;
  status: "completed" | "failed";
  outputTail?: string;
}

interface RunSimpleResponse {
  status: "completed" | "failed" | "partial";
  message?: string;
  subtaskResults?: RunSimpleSubtaskResult[];
}

async function postRunSimple(prompt: string): Promise<RunSimpleResponse> {
  const { normalizedBaseUrl, resolvedToken } = await resolveOpenworkConnection();
  const headers = new Headers({ "Content-Type": "application/json" });
  if (resolvedToken) headers.set("Authorization", `Bearer ${resolvedToken}`);
  const response = await fetch(
    normalizedBaseUrl ? `${normalizedBaseUrl}/teams/run-simple` : "/teams/run-simple",
    { method: "POST", headers, body: JSON.stringify({ prompt }) },
  );
  const body = (await response.json().catch(() => ({}))) as {
    error?: unknown;
    hint?: unknown;
  } & RunSimpleResponse;
  if (!response.ok) {
    const reason = typeof body.error === "string" ? body.error : `Request failed: ${response.status}`;
    throw new Error(typeof body.hint === "string" ? `${reason}: ${body.hint}` : reason);
  }
  return body;
}

function mapSubtaskToMember(
  member: ExpertGroupMemberResult,
  sub: RunSimpleSubtaskResult | undefined,
): ExpertGroupMemberResult {
  if (!sub) return { ...member, status: "pending" };
  const agentLabel = sub.agentId ? `[${sub.agentId}] ` : "";
  const output = [agentLabel && agentLabel, sub.outputTail ?? ""].filter(Boolean).join("");
  return {
    expertId: member.expertId,
    status: sub.status === "failed" ? "failed" : "completed",
    output: output || undefined,
  };
}

/**
 * 执行专家组任务：真实调用后端 `/teams/run-simple` 并行执行，
 * 并将子任务结果按顺序归属到组长 + 成员。失败时返回失败的专家组结果，
 * 绝不伪造“已完成”。
 */
export async function runExpertGroup(
  group: ExpertGroup,
  prompt: string,
  callbacks?: ExpertGroupRunnerCallbacks,
): Promise<ExpertGroupResult> {
  const startedAt = new Date().toISOString();
  const orderedExpertIds = [group.leaderId, ...group.memberIds];
  const pendingMembers: ExpertGroupMemberResult[] = orderedExpertIds.map((expertId) => ({
    expertId,
    status: "pending",
  }));

  for (const member of pendingMembers) {
    callbacks?.onMemberUpdate?.(member.expertId, { ...member, status: "running" });
  }

  let result: ExpertGroupResult;

  try {
    const data = await postRunSimple(prompt);
    const members = pendingMembers.map((member, index) =>
      mapSubtaskToMember(member, data.subtaskResults?.[index]),
    );
    const anyMemberFailed = members.some((m) => m.status === "failed");
    result = {
      groupId: group.id,
      prompt,
      status: !anyMemberFailed && data.status === "completed" ? "completed" : "failed",
      members,
      synthesis: data.message,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result = {
      groupId: group.id,
      prompt,
      status: "failed",
      members: pendingMembers.map((member) => ({
        ...member,
        status: "failed",
        error: message,
      })),
      synthesis: "专家组执行失败，详见成员错误信息。",
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  for (const member of result.members) {
    callbacks?.onMemberUpdate?.(member.expertId, member);
  }
  callbacks?.onComplete?.(result);

  return persistResult(result);
}