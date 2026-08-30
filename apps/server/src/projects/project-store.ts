/**
 * 项目模板 + 邀请审批 SQLite 存储层。
 *
 * 表 project_templates：用户自建项目模板。
 * 表 project_invites：项目邀请码与审批状态。
 * 表 project_members：已审批通过的项目成员。
 */

import type { RuntimeSqliteDatabase } from "../runtime-db.js";
import type {
  CreateTemplateInput,
  ProjectTemplate,
} from "./template-types.js";
import type {
  ProjectInvite,
  ProjectMember,
  InviteStatus,
} from "./invite-types.js";

const CREATE_TEMPLATES_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS project_templates (" +
  "template_id TEXT PRIMARY KEY NOT NULL, " +
  "name TEXT NOT NULL, " +
  "description TEXT NOT NULL DEFAULT '', " +
  "category TEXT NOT NULL DEFAULT 'general', " +
  "icon TEXT NOT NULL DEFAULT 'folder', " +
  "plans_json TEXT NOT NULL DEFAULT '[]', " +
  "created_at INTEGER NOT NULL, " +
  "updated_at INTEGER NOT NULL)";

const CREATE_INVITES_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS project_invites (" +
  "invite_id TEXT PRIMARY KEY NOT NULL, " +
  "project_id TEXT NOT NULL, " +
  "invite_code TEXT NOT NULL UNIQUE, " +
  "email TEXT, " +
  "status TEXT NOT NULL DEFAULT 'pending', " +
  "invited_by TEXT NOT NULL, " +
  "created_at INTEGER NOT NULL, " +
  "resolved_at INTEGER, " +
  "resolved_by TEXT)";

const CREATE_MEMBERS_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS project_members (" +
  "member_id TEXT PRIMARY KEY NOT NULL, " +
  "project_id TEXT NOT NULL, " +
  "user_id TEXT NOT NULL, " +
  "name TEXT NOT NULL, " +
  "role TEXT NOT NULL DEFAULT 'member', " +
  "joined_at INTEGER NOT NULL, " +
  "UNIQUE(project_id, user_id))";

interface TemplateRow {
  template_id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  plans_json: string;
  created_at: number;
  updated_at: number;
}

interface InviteRow {
  invite_id: string;
  project_id: string;
  invite_code: string;
  email: string | null;
  status: string;
  invited_by: string;
  created_at: number;
  resolved_at: number | null;
  resolved_by: string | null;
}

interface MemberRow {
  member_id: string;
  project_id: string;
  user_id: string;
  name: string;
  role: string;
  joined_at: number;
}

function toTemplate(row: TemplateRow): ProjectTemplate {
  return {
    templateId: row.template_id,
    name: row.name,
    description: row.description,
    category: row.category,
    icon: row.icon,
    plans: JSON.parse(row.plans_json) as ProjectTemplate["plans"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toInvite(row: InviteRow): ProjectInvite {
  return {
    inviteId: row.invite_id,
    projectId: row.project_id,
    inviteCode: row.invite_code,
    email: row.email,
    status: row.status as InviteStatus,
    invitedBy: row.invited_by,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
  };
}

function toMember(row: MemberRow): ProjectMember {
  return {
    memberId: row.member_id,
    projectId: row.project_id,
    userId: row.user_id,
    name: row.name,
    role: row.role as "owner" | "admin" | "member",
    joinedAt: row.joined_at,
  };
}

export interface ProjectStore {
  insertTemplate(template: ProjectTemplate): void;
  getTemplate(templateId: string): ProjectTemplate | null;
  listTemplates(): ProjectTemplate[];
  updateTemplate(templateId: string, input: CreateTemplateInput, now: number): boolean;
  deleteTemplate(templateId: string): boolean;

  insertInvite(invite: ProjectInvite): void;
  getInvite(inviteId: string): ProjectInvite | null;
  getInviteByCode(code: string): ProjectInvite | null;
  listInvites(projectId: string): ProjectInvite[];
  updateInviteStatus(inviteId: string, status: InviteStatus, resolvedBy: string, now: number): boolean;

  insertMember(member: ProjectMember): void;
  listMembers(projectId: string): ProjectMember[];
  isMember(projectId: string, userId: string): boolean;
  removeMember(projectId: string, userId: string): boolean;
}

export class SqliteProjectStore implements ProjectStore {
  private readonly runtime: RuntimeSqliteDatabase;

  constructor(runtime: RuntimeSqliteDatabase) {
    this.runtime = runtime;
    if (runtime.kind === "bun") {
      runtime.sqlite.run(CREATE_TEMPLATES_TABLE_SQL);
      runtime.sqlite.run(CREATE_INVITES_TABLE_SQL);
      runtime.sqlite.run(CREATE_MEMBERS_TABLE_SQL);
    } else {
      runtime.sqlite.exec(CREATE_TEMPLATES_TABLE_SQL);
      runtime.sqlite.exec(CREATE_INVITES_TABLE_SQL);
      runtime.sqlite.exec(CREATE_MEMBERS_TABLE_SQL);
    }
  }

  insertTemplate(template: ProjectTemplate): void {
    this.runtime.sqlite.prepare(
      "INSERT INTO project_templates (template_id, name, description, category, icon, plans_json, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      template.templateId,
      template.name,
      template.description,
      template.category,
      template.icon,
      JSON.stringify(template.plans),
      template.createdAt,
      template.updatedAt,
    );
  }

  getTemplate(templateId: string): ProjectTemplate | null {
    const row = this.runtime.sqlite.prepare(
      "SELECT template_id, name, description, category, icon, plans_json, created_at, updated_at " +
        "FROM project_templates WHERE template_id = ?",
    ).get(templateId) as TemplateRow | undefined;
    return row ? toTemplate(row) : null;
  }

  listTemplates(): ProjectTemplate[] {
    const rows = this.runtime.sqlite.prepare(
      "SELECT template_id, name, description, category, icon, plans_json, created_at, updated_at " +
        "FROM project_templates ORDER BY updated_at DESC",
    ).all() as TemplateRow[];
    return rows.map(toTemplate);
  }

  updateTemplate(templateId: string, input: CreateTemplateInput, now: number): boolean {
    const result = this.runtime.sqlite.prepare(
      "UPDATE project_templates SET name = ?, description = ?, category = ?, icon = ?, plans_json = ?, updated_at = ? " +
        "WHERE template_id = ?",
    ).run(
      input.name,
      input.description,
      input.category,
      input.icon,
      JSON.stringify(input.plans),
      now,
      templateId,
    );
    return changesGreaterThanZero(result);
  }

  deleteTemplate(templateId: string): boolean {
    const result = this.runtime.sqlite.prepare(
      "DELETE FROM project_templates WHERE template_id = ?",
    ).run(templateId);
    return changesGreaterThanZero(result);
  }

  insertInvite(invite: ProjectInvite): void {
    this.runtime.sqlite.prepare(
      "INSERT INTO project_invites (invite_id, project_id, invite_code, email, status, invited_by, created_at, resolved_at, resolved_by) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      invite.inviteId,
      invite.projectId,
      invite.inviteCode,
      invite.email,
      invite.status,
      invite.invitedBy,
      invite.createdAt,
      invite.resolvedAt,
      invite.resolvedBy,
    );
  }

  getInviteByCode(code: string): ProjectInvite | null {
    const row = this.runtime.sqlite.prepare(
      "SELECT invite_id, project_id, invite_code, email, status, invited_by, created_at, resolved_at, resolved_by " +
        "FROM project_invites WHERE invite_code = ?",
    ).get(code) as InviteRow | undefined;
    return row ? toInvite(row) : null;
  }

  getInvite(inviteId: string): ProjectInvite | null {
    const row = this.runtime.sqlite.prepare(
      "SELECT invite_id, project_id, invite_code, email, status, invited_by, created_at, resolved_at, resolved_by " +
        "FROM project_invites WHERE invite_id = ?",
    ).get(inviteId) as InviteRow | undefined;
    return row ? toInvite(row) : null;
  }

  listInvites(projectId: string): ProjectInvite[] {
    const rows = this.runtime.sqlite.prepare(
      "SELECT invite_id, project_id, invite_code, email, status, invited_by, created_at, resolved_at, resolved_by " +
        "FROM project_invites WHERE project_id = ? ORDER BY created_at DESC",
    ).all(projectId) as InviteRow[];
    return rows.map(toInvite);
  }

  updateInviteStatus(inviteId: string, status: InviteStatus, resolvedBy: string, now: number): boolean {
    const result = this.runtime.sqlite.prepare(
      "UPDATE project_invites SET status = ?, resolved_at = ?, resolved_by = ? WHERE invite_id = ? AND status = 'pending'",
    ).run(status, now, resolvedBy, inviteId);
    return changesGreaterThanZero(result);
  }

  insertMember(member: ProjectMember): void {
    this.runtime.sqlite.prepare(
      "INSERT INTO project_members (member_id, project_id, user_id, name, role, joined_at) " +
        "VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      member.memberId,
      member.projectId,
      member.userId,
      member.name,
      member.role,
      member.joinedAt,
    );
  }

  listMembers(projectId: string): ProjectMember[] {
    const rows = this.runtime.sqlite.prepare(
      "SELECT member_id, project_id, user_id, name, role, joined_at " +
        "FROM project_members WHERE project_id = ? ORDER BY joined_at ASC",
    ).all(projectId) as MemberRow[];
    return rows.map(toMember);
  }

  isMember(projectId: string, userId: string): boolean {
    const row = this.runtime.sqlite.prepare(
      "SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1",
    ).get(projectId, userId);
    return row != null;
  }

  removeMember(projectId: string, userId: string): boolean {
    const result = this.runtime.sqlite.prepare(
      "DELETE FROM project_members WHERE project_id = ? AND user_id = ?",
    ).run(projectId, userId);
    return changesGreaterThanZero(result);
  }
}

function changesGreaterThanZero(result: unknown): boolean {
  return typeof result === "object" && result !== null && "changes" in result
    ? Number((result as { changes: unknown }).changes) > 0
    : true;
}