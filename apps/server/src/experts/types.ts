/**
 * Expert 类型定义 - 专家抽象层
 *
 * ExpertDefinition 建于 AgentTeamMember 之上：在团队成员（agentId + adapter + role）
 * 之上叠加专家画像（name/description/systemPrompt/methodology/skills/model/avatar），
 * 使一个专家既是可调度的团队成员，又是可管理、可持久化的领域知识单元。
 *
 * 对应 WorkBuddy 的 Expert / 专家团概念：
 * - 专家 = 领域知识（systemPrompt/methodology）+ 技能包（skills）+ 模型偏好（model）
 * - 专家团 = 按角色/能力组合多个专家形成的 AgentTeam
 */

import type { AgentSidecarAdapter } from "../agent-sidecar/types.js";
import type { AgentTeamMember, MemberRole } from "../agent-team/types.js";

/** 专家定义（持久化模型） */
export interface ExpertDefinition {
  /** 专家 ID（slug 化名称，唯一） */
  id: string;
  /** 显示名 */
  name: string;
  /** 一句话描述（领域/专长） */
  description: string;
  /** 系统提示词（专家人格 + 领域约束） */
  systemPrompt: string;
  /** 方法论（工作流/思考框架描述） */
  methodology: string;
  /** 技能包：绑定到本地 SKILL.md 的技能名列表 */
  skills: string[];
  /** 模型偏好（"provider/model"，可选） */
  model?: string;
  /** 头像（emoji 或 URL，可选） */
  avatar?: string;
  /** 绑定的 CLI agent（对应 AgentTeamMember.agentId，如 "opencode"） */
  agentId: string;
  /** 团队角色（对应 AgentTeamMember.role，可选） */
  role?: MemberRole;
  createdAt: string;
  updatedAt: string;
  source: "local" | "builtin";
  /** 落盘路径（运行时填充） */
  path?: string;
}

/** 创建专家输入 */
export interface ExpertCreateInput {
  name: string;
  description?: string;
  systemPrompt: string;
  methodology?: string;
  skills?: string[];
  model?: string;
  avatar?: string;
  agentId?: string;
  role?: MemberRole;
}

/** 更新专家输入（全部可选，部分更新） */
export interface ExpertUpdateInput {
  name?: string;
  description?: string;
  systemPrompt?: string;
  methodology?: string;
  skills?: string[];
  model?: string;
  avatar?: string;
  agentId?: string;
  role?: MemberRole;
}

/** 专家 → AgentTeamMember 转换结果（adapter 由调用方注入） */
export function toAgentTeamMember(
  expert: ExpertDefinition,
  adapter: AgentSidecarAdapter,
): AgentTeamMember {
  return {
    agentId: expert.agentId,
    adapter,
    role: expert.role,
  };
}
