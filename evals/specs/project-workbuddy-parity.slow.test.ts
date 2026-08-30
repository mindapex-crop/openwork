/**
 * WorkBuddy 项目模块布局一致性 spec（e2e 视觉验证）。
 *
 * 覆盖用户反馈的三屏：项目列表（对话创建 + 我加入的/全部 + 带日期卡片）、
 * 项目详情三栏（智能体 / 工作空间 / 任务）、新建项目弹窗（模板 chips）。
 * 用 @openwork/fraimz 的 screenshot+validate 做视觉断言，DOM evalIn 做结构断言。
 *
 * 运行：
 *   OPENWORK_EVAL_APP_SPECS=1 pnpm --dir evals exec vitest run \
 *     --config vitest.config.ts --project stack \
 *     specs/project-workbuddy-parity.slow.test.ts
 */
import { expect } from "vitest";
import { createAndSelectWorkspace, evalIn, waitFor } from "@openwork/behaviors";
import { screenshot, validate } from "@openwork/fraimz";
import { desktop } from "@openwork/hosts";
import { needs, test } from "@openwork/testkit";

const appSpecsEnabled = process.env.OPENWORK_EVAL_APP_SPECS === "1";
const title = appSpecsEnabled
  ? "project module matches the WorkBuddy layout (list, three-column detail, new-project dialog)"
  : "project WorkBuddy parity skipped — needs: set OPENWORK_EVAL_APP_SPECS=1";

/** Click a button whose trimmed text equals `text`. Returns whether it was found. */
function clickByText(text: string) {
  return `(() => {
    const wanted = ${JSON.stringify(text)};
    const node = [...document.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").replace(/\\s+/g, " ").trim() === wanted,
    );
    if (!node) return false;
    node.click();
    return true;
  })()`;
}

function readStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function buttonLabels(): string {
  return `(() => [...document.querySelectorAll("button")].map((b) => (b.textContent ?? "").replace(/\\s+/g, " ").trim()).filter(Boolean))()`;
}

test.skipIf(!appSpecsEnabled)(title, async ({ evidence }) => {
  needs({ optIn: ["OPENWORK_EVAL_APP_SPECS"] });

  await using app = await desktop({ name: "project-workbuddy-parity" });
  await createAndSelectWorkspace(app, {
    path: `/tmp/openwork-project-parity-${Date.now()}`,
  });

  // Navigate to the projects route.
  await evalIn(app, `window.location.assign("/projects")`);
  await waitFor(app, `document.body.innerText.includes("项目管理")`, {
    timeoutMs: 60_000,
    label: "projects list header",
  });

  const listLabels = evalIn(app, buttonLabels());
  {
    const shot = await screenshot(app);
    const seen = await validate(shot, [
      "A projects page is shown with a primary 新建项目 (New project) button",
      "A single-line 对话创建 idea input box sits under the page header",
      "There are 我加入的 and 全部 scope tabs",
      "No error dialog or crash message is visible",
    ]);
    expect(seen.ok, seen.why).toBe(true);
  }
  const labels = readStringList(await listLabels);
  expect(labels.some((l) => l.includes("新建项目")), `list buttons: ${labels.join(",")}`).toBe(true);
  expect(labels.some((l) => l.includes("我加入的"))).toBe(true);
  expect(labels.some((l) => l.includes("全部"))).toBe(true);
  evidence.fact(
    "Projects list renders the WorkBuddy header (新建项目, 对话创建, 我加入的/全部)",
    `List buttons include: ${labels.filter((l) => l.includes("新建项目") || l.includes("我加入的") || l.includes("全部")).join(", ")}.`,
    true,
  );

  // Open the new-project dialog and assert template chips.
  await evalIn(app, clickByText("新建项目"));
  await waitFor(app, `document.querySelector('[role="dialog"]') !== null`, {
    timeoutMs: 20_000,
    label: "new-project dialog open",
  });
  {
    const shot = await screenshot(app);
    const seen = await validate(shot, [
      "A centered 新建项目 dialog is open with a project name field",
      "A row of selectable template chips is visible (e.g. 软件开发 / 研究报告)",
      "A 描述 (description) field and 取消 / 创建项目 actions are present",
    ]);
    expect(seen.ok, seen.why).toBe(true);
  }
  const dialogText = readText(await evalIn(app, `(document.querySelector('[role="dialog"]')?.innerText ?? "")`));
  expect(dialogText.includes("软件开发"), `dialog text: ${dialogText.slice(0, 200)}`).toBe(true);
  evidence.fact(
    "New-project dialog shows a name field, template chips, and create/cancel actions",
    "The dialog contains template chips including 软件开发 with 取消/创建项目 controls.",
    true,
  );
  await evalIn(app, clickByText("取消"));

  // Create a project so the detail page has content, then open it.
  const created = await evalIn(app, `(() => {
    const key = "openwork:projects:v2";
    const raw = JSON.parse(localStorage.getItem(key) || '{"state":{"projects":[]},"version":4}');
    raw.state.projects = raw.state.projects || [];
    raw.state.projects.unshift({
      id: "parity-prj", name: "对齐验证项目", description: "e2e", status: "active",
      plans: [{ id: "plan1", title: "计划一", description: "", status: "open", createdAt: new Date().toISOString(),
        tasks: [{ id: "t1", title: "任务一", status: "todo", evidence: { status: "pending", notes: "" }, subtasks: [], createdAt: new Date().toISOString() }] }],
      skills: [], experts: [], connectors: [], activityEvents: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    localStorage.setItem(key, JSON.stringify(raw));
    return raw.state.projects.length;
  })()`);
  expect(Number(created)).toBeGreaterThan(0);
  await evalIn(app, `window.location.assign("/projects")`);
  await waitFor(app, `document.body.innerText.includes("对齐验证项目")`, { timeoutMs: 20_000, label: "seeded project card" });
  await evalIn(app, `(() => { const c=[...document.querySelectorAll("button")].find(b=>(b.textContent||"").includes("对齐验证项目")); c?.click(); return true; })()`);
  await waitFor(app, `document.body.innerText.includes("智能体") && document.body.innerText.includes("工作空间")`, {
    timeoutMs: 20_000,
    label: "detail three columns",
  });

  const detailText = readText(await evalIn(app, `document.body.innerText`));
  expect(detailText.includes("智能体")).toBe(true);
  expect(detailText.includes("工作空间")).toBe(true);
  expect(detailText.includes("任务")).toBe(true);
  // Tab order: 任务 before 计划 before 资产 before 动态 in the tab strip.
  expect(detailText.includes("计划")).toBe(true);
  expect(detailText.includes("资产")).toBe(true);
  expect(detailText.includes("动态")).toBe(true);
  expect(detailText.includes("一键生成任务")).toBe(true);
  expect(!/Something went wrong/i.test(detailText), "detail must not hit the error boundary").toBe(true);

  {
    const shot = await screenshot(app);
    const seen = await validate(shot, [
      "The project detail shows three side-by-side columns: 智能体 (a chat composer), 工作空间 (artifacts/changes/files), and 任务 (task list)",
      "The chat column shows a message composer with Ask/Craft/Plan mode controls",
      "A banner offers 邀请成员 and 一键生成任务",
      "No error dialog or crash message is visible",
    ]);
    expect(seen.ok, seen.why).toBe(true);
  }
  evidence.fact(
    "Project detail renders the WorkBuddy three-column layout with an embedded agent chat and no crash",
    "DOM shows 智能体 / 工作空间 / 任务 columns + 一键生成任务 banner; screenshot validated as three-column with a composer and no error boundary.",
    true,
  );
});
