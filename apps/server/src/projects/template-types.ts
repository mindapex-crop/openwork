/**
 * 项目模板：类型定义。
 *
 * 模板包含预置的 plans/tasks 结构与配置，用户可基于模板创建项目。
 */

export interface ProjectTemplate {
  templateId: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  plans: ProjectTemplatePlan[];
  createdAt: number;
  updatedAt: number;
}

export interface ProjectTemplatePlan {
  title: string;
  description: string;
  tasks: ProjectTemplateTask[];
}

export interface ProjectTemplateTask {
  title: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high";
}

export interface CreateTemplateInput {
  name: string;
  description: string;
  category: string;
  icon: string;
  plans: ProjectTemplatePlan[];
}