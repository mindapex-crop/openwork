/**
 * 专家组（Expert Group）领域类型。
 *
 * 专家组将多位专家组织为以一个组长为首的协作团队，按照选定策略
 * 自动拆解任务、并行执行、汇总结果。数据前端持久化（localStorage），
 * 后端可由他人实现，联调前以 TODO 标注。
 */

export type ExpertGroupStrategy = "conservative" | "balanced" | "aggressive";

export interface ExpertGroup {
  id: string;
  name: string;
  description: string;
  /** 组长专家 ID（团队领导，负责任务拆解与结果汇总）。 */
  leaderId: string;
  /** 成员专家 ID 列表（不含组长）。 */
  memberIds: string[];
  strategy: ExpertGroupStrategy;
  createdAt: string;
  updatedAt: string;
}

export type ExpertGroupInput = {
  name: string;
  description: string;
  leaderId: string;
  memberIds: string[];
  strategy: ExpertGroupStrategy;
};

/** 专家组成员执行状态。 */
export type ExpertGroupMemberStatus = "pending" | "running" | "completed" | "failed";

export interface ExpertGroupMemberResult {
  expertId: string;
  status: ExpertGroupMemberStatus;
  output?: string;
  error?: string;
}

export type ExpertGroupRunStatus = "idle" | "running" | "completed" | "failed";

export interface ExpertGroupResult {
  groupId: string;
  prompt: string;
  status: ExpertGroupRunStatus;
  members: ExpertGroupMemberResult[];
  /** 组长对全部成员输出的综合汇总。 */
  synthesis?: string;
  startedAt: string;
  completedAt?: string;
}

export type ExpertGroupStore = {
  groups: ExpertGroup[];
  createGroup: (input: ExpertGroupInput) => Promise<string>;
  updateGroup: (id: string, patch: Partial<ExpertGroupInput>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  listGroups: () => ExpertGroup[];
  getGroup: (id: string) => ExpertGroup | undefined;
};
