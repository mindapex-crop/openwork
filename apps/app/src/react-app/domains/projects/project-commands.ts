import type { Project } from "./project-store";

export type ProjectCommand =
  | { kind: "create_task"; title: string }
  | { kind: "complete_task"; keyword: string }
  | { kind: "assign_task"; keyword: string; assignee: string }
  | { kind: "switch_plan"; name: string }
  | { kind: "note"; text: string }
  | { kind: "empty" };

export function parseProjectCommand(
  input: string,
  _project: Project | null,
  _selectedPlanId: string | null,
): ProjectCommand {
  const text = input.trim();
  if (!text) return { kind: "empty" };

  const createMatch = text.match(/^(?:新建任务|task|add\s+task)\s+(.+)$/i);
  if (createMatch) {
    return { kind: "create_task", title: createMatch[1].trim() };
  }

  const completeMatch = text.match(/^(?:完成任务|complete|done)\s+(.+)$/i);
  if (completeMatch) {
    return { kind: "complete_task", keyword: completeMatch[1].trim() };
  }

  const assignMatch = text.match(/^(?:分配|assign)\s+(.+)\s+(?:给|to)\s+(.+)$/i);
  if (assignMatch) {
    return { kind: "assign_task", keyword: assignMatch[1].trim(), assignee: assignMatch[2].trim() };
  }

  const switchMatch = text.match(/^(?:切换计划|switch\s+plan)\s+(.+)$/i);
  if (switchMatch) {
    return { kind: "switch_plan", name: switchMatch[1].trim() };
  }

  return { kind: "note", text };
}
