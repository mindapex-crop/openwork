import type { Automation, Project } from "../types";

/**
 * 项目 / 自动化 mock 数据。
 * TODO 联调：服务端（apps/server）暂无 /projects、/automations HTTP 路由，
 * 阶段四先以示例数据支撑 UI，后续按需新增契约。
 */

export const mockProjects: Project[] = [
  {
    id: "proj_demo_1",
    name: "OpenWork Mobile",
    description: "阶段四 · React Native 移动端工程",
    status: "active",
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: "proj_demo_2",
    name: "专家市场",
    description: "专家/专家团页面与市场落地",
    status: "active",
    updatedAt: Date.now() - 1000 * 60 * 60 * 26,
  },
  {
    id: "proj_demo_3",
    name: "Relay Sync 接力同步",
    description: "云上/云下项目与上下文同步（规划中）",
    status: "archived",
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
  },
];

export const mockAutomations: Automation[] = [
  {
    id: "auto_demo_1",
    name: "每周代码评审",
    description: "周五 18:00 汇总本周 PR 变更并生成评审清单",
    enabled: true,
    trigger: "cron 0 18 * * 5",
    updatedAt: Date.now() - 1000 * 60 * 60 * 3,
  },
  {
    id: "auto_demo_2",
    name: "群聊 @ 自动回复",
    description: "在 IM 群中被 @ 时按专家画像回复",
    enabled: true,
    trigger: "mention",
    updatedAt: Date.now() - 1000 * 60 * 60 * 30,
  },
  {
    id: "auto_demo_3",
    name: "会议纪要归档",
    description: "会议结束后生成纪要并归档到资料库",
    enabled: false,
    trigger: "event:meeting.ended",
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
];
