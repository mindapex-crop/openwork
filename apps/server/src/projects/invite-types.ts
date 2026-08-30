/**
 * 项目邀请审批：类型定义。
 */

export type InviteStatus = "pending" | "approved" | "rejected";

export interface ProjectInvite {
  inviteId: string;
  projectId: string;
  inviteCode: string;
  email: string | null;
  status: InviteStatus;
  invitedBy: string;
  createdAt: number;
  resolvedAt: number | null;
  resolvedBy: string | null;
}

export interface ProjectMember {
  memberId: string;
  projectId: string;
  userId: string;
  name: string;
  role: "owner" | "admin" | "member";
  joinedAt: number;
}

export interface CreateInviteInput {
  projectId: string;
  email?: string;
  invitedBy: string;
}

export interface JoinProjectInput {
  inviteCode: string;
  userId: string;
  name: string;
}