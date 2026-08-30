/**
 * 项目服务层：模板 CRUD + 邀请审批 + 成员管理 + 容量计算。
 */

import type { ProjectStore } from "./project-store.js";
import type { CreateTemplateInput, ProjectTemplate } from "./template-types.js";
import type {
  CreateInviteInput,
  JoinProjectInput,
  ProjectInvite,
  ProjectMember,
} from "./invite-types.js";

const DEFAULT_CAPACITY_BYTES = 5 * 1024 * 1024 * 1024;

export interface ProjectService {
  createTemplate(input: CreateTemplateInput, now: number): ProjectTemplate;
  listTemplates(): ProjectTemplate[];
  getTemplate(templateId: string): ProjectTemplate | null;
  updateTemplate(templateId: string, input: CreateTemplateInput, now: number): ProjectTemplate;
  deleteTemplate(templateId: string): boolean;

  createInvite(input: CreateInviteInput, now: number): ProjectInvite;
  listInvites(projectId: string): ProjectInvite[];
  approveInvite(inviteId: string, resolvedBy: string, now: number): ProjectInvite;
  rejectInvite(inviteId: string, resolvedBy: string, now: number): ProjectInvite;
  joinProject(input: JoinProjectInput, now: number): ProjectMember;
  listMembers(projectId: string): ProjectMember[];
  removeMember(projectId: string, userId: string): boolean;

  computeCapacity(usedBytes: number): { used: number; total: number; percentage: number };
}

export function createProjectService(store: ProjectStore): ProjectService {
  function generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function generateInviteCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  return {
    createTemplate(input: CreateTemplateInput, now: number): ProjectTemplate {
      validateTemplateInput(input);
      const template: ProjectTemplate = {
        templateId: generateId("tpl"),
        name: input.name.trim(),
        description: input.description.trim(),
        category: input.category.trim() || "general",
        icon: input.icon.trim() || "folder",
        plans: input.plans,
        createdAt: now,
        updatedAt: now,
      };
      store.insertTemplate(template);
      return template;
    },

    listTemplates(): ProjectTemplate[] {
      return store.listTemplates();
    },

    getTemplate(templateId: string): ProjectTemplate | null {
      return store.getTemplate(templateId);
    },

    updateTemplate(templateId: string, input: CreateTemplateInput, now: number): ProjectTemplate {
      validateTemplateInput(input);
      const updated = store.updateTemplate(templateId, input, now);
      if (!updated) {
        throw new ProjectServiceError("template_not_found", "Template not found.");
      }
      const template = store.getTemplate(templateId);
      if (!template) {
        throw new ProjectServiceError("template_not_found", "Template not found after update.");
      }
      return template;
    },

    deleteTemplate(templateId: string): boolean {
      return store.deleteTemplate(templateId);
    },

    createInvite(input: CreateInviteInput, now: number): ProjectInvite {
      if (!input.projectId.trim()) {
        throw new ProjectServiceError("invalid_project_id", "Project ID is required.");
      }
      if (!input.invitedBy.trim()) {
        throw new ProjectServiceError("invalid_invited_by", "Invited by is required.");
      }
      const invite: ProjectInvite = {
        inviteId: generateId("inv"),
        projectId: input.projectId,
        inviteCode: generateInviteCode(),
        email: input.email?.trim() || null,
        status: "pending",
        invitedBy: input.invitedBy,
        createdAt: now,
        resolvedAt: null,
        resolvedBy: null,
      };
      store.insertInvite(invite);
      return invite;
    },

    listInvites(projectId: string): ProjectInvite[] {
      return store.listInvites(projectId);
    },

    approveInvite(inviteId: string, resolvedBy: string, now: number): ProjectInvite {
      const approved = store.updateInviteStatus(inviteId, "approved", resolvedBy, now);
      if (!approved) {
        throw new ProjectServiceError("invite_not_found", "Pending invite not found.");
      }
      const invite = store.getInvite(inviteId);
      if (!invite) {
        throw new ProjectServiceError("invite_not_found", "Invite not found after approval.");
      }
      return invite;
    },

    rejectInvite(inviteId: string, resolvedBy: string, now: number): ProjectInvite {
      const rejected = store.updateInviteStatus(inviteId, "rejected", resolvedBy, now);
      if (!rejected) {
        throw new ProjectServiceError("invite_not_found", "Pending invite not found.");
      }
      const invite = store.getInvite(inviteId);
      if (!invite) {
        throw new ProjectServiceError("invite_not_found", "Invite not found after rejection.");
      }
      return invite;
    },

    joinProject(input: JoinProjectInput, now: number): ProjectMember {
      const invite = store.getInviteByCode(input.inviteCode);
      if (!invite) {
        throw new ProjectServiceError("invite_not_found", "Invite code not found.");
      }
      if (invite.status !== "approved") {
        throw new ProjectServiceError("invite_not_approved", "Invite has not been approved.");
      }
      if (store.isMember(invite.projectId, input.userId)) {
        throw new ProjectServiceError("already_member", "User is already a member.");
      }
      const member: ProjectMember = {
        memberId: generateId("mem"),
        projectId: invite.projectId,
        userId: input.userId,
        name: input.name.trim(),
        role: "member",
        joinedAt: now,
      };
      store.insertMember(member);
      return member;
    },

    listMembers(projectId: string): ProjectMember[] {
      return store.listMembers(projectId);
    },

    removeMember(projectId: string, userId: string): boolean {
      return store.removeMember(projectId, userId);
    },

    computeCapacity(usedBytes: number): { used: number; total: number; percentage: number } {
      const used = Math.max(0, usedBytes);
      const total = DEFAULT_CAPACITY_BYTES;
      const percentage = Math.min(100, (used / total) * 100);
      return { used, total, percentage };
    },
  };
}

function validateTemplateInput(input: CreateTemplateInput): void {
  if (!input.name.trim()) {
    throw new ProjectServiceError("invalid_name", "Template name is required.");
  }
  if (!Array.isArray(input.plans)) {
    throw new ProjectServiceError("invalid_plans", "Plans must be an array.");
  }
}

export class ProjectServiceError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProjectServiceError";
  }
}

export const DEFAULT_CAPACITY = DEFAULT_CAPACITY_BYTES;