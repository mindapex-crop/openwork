/**
 * 专家（Expert）领域类型。
 *
 * 数据契约（后端由他人实现，联调前以 TODO 标注）：
 * - GET    /api/experts     → { experts: [{ id, name, description, systemPrompt, skills, model, avatar }] }
 * - POST   /api/experts     → { expert: Expert }
 * - PUT    /api/experts/:id → { expert: Expert }
 * - DELETE /api/experts/:id → { ok: true }
 *
 * methodology 为前端编辑表单的额外字段（专家工作方法），随请求一并提交，
 * 后端可忽略未知字段；skills 绑定本地技能目录（domains/skills/skill-catalog）。
 */

export type Expert = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  /** 专家工作方法/流程说明（编辑表单字段，后端可能暂不持久化）。 */
  methodology: string;
  /** 绑定的本地技能（skill-catalog 的 id 或 name）。 */
  skills: string[];
  model?: string;
  avatar?: string;
  /** 专家作者/创建者名称（WorkBuddy 风格展示）。 */
  author?: string;
  /** WorkBuddy 专家应用分类（企业/日常/学习/效率/自媒体/电商/其他），缺省归入 "其他"。 */
  category?: string;
};

/** 专家创建/更新表单载荷。 */
export type ExpertInput = {
  name: string;
  description: string;
  systemPrompt: string;
  methodology: string;
  skills: string[];
  model?: string;
  avatar?: string;
  author?: string;
  category?: string;
};

/** GET /api/experts 响应。 */
export type ExpertsResponse = {
  experts: Expert[];
};

/** POST/PUT /api/experts 响应。 */
export type ExpertResponse = {
  expert: Expert;
};

export type ExpertsStatus = "idle" | "loading" | "ready" | "error";
