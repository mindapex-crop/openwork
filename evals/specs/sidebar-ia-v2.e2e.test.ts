import { expect } from "vitest";
import { createAndSelectWorkspace, evalIn, go, waitFor } from "@openwork/behaviors";
import { screenshot, validate } from "@openwork/test-evidence";
import { desktop } from "@openwork/hosts";
import { needs, test } from "@openwork/testkit";

/**
 * Sidebar IA v2 — stage one PR1.
 *
 * Frame 2: the sidebar exposes eight module destinations in order —
 * Assistant, Experts, Skills, Connectors, Library, Automations, Projects,
 * Inspiration. Knowledge folds into Library; Collab is gone from the sidebar.
 *
 * Frame 5: switching the app language (zh → en) relabels the sidebar
 * immediately.
 *
 * Frame 6: Experts and Inspiration are honest placeholders — the concept is
 * explained and "coming soon" is stated.
 */

const requirements = { optIn: ["OPENWORK_EVAL_E2E_TESTS"] };
const missingRequirements = requirements.optIn
  .filter((key) => !process.env[key])
  .join(", ");
const enabled = missingRequirements.length === 0;
const title = enabled
  ? "the sidebar exposes the eight v2 module destinations, relabels on language switch, and shows Experts/Inspiration placeholders"
  : `sidebar IA v2 skipped — needs: set ${requirements.optIn.join(", ")}=1`;

/** Reads the ordered labels of the module navigation group in the sidebar. */
const moduleNavLabels = `(() => {
  const nav = document.querySelector('[data-sidebar-module-nav]');
  if (!nav) return null;
  return [...nav.querySelectorAll('button[aria-label]')]
    .map((button) => (button.getAttribute('aria-label') ?? '').replace(/\\s+/g, ' ').trim())
    .filter((label) => label.length > 0);
})()`;

/** Reads the visible text of the module navigation group (labelContent case). */
const moduleNavText = `(() => {
  const nav = document.querySelector('[data-sidebar-module-nav]');
  if (!nav) return null;
  return [...nav.querySelectorAll('li')]
    .map((item) => (item.textContent ?? '').replace(/\\s+/g, ' ').trim())
    .filter((text) => text.length > 0);
})()`;

/** Whole sidebar text, used to prove Collab/Knowledge rows are absent. */
const sidebarText = `(() => {
  const sidebar = document.querySelector('[data-sidebar="sidebar"]');
  return sidebar ? (sidebar.textContent ?? '').replace(/\\s+/g, ' ').trim() : null;
})()`;

function labels(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error(`Module nav labels were not readable: ${JSON.stringify(value)}`);
  return value.map((entry) => (typeof entry === "string" ? entry : ""));
}

test(title, async ({ evidence }) => {
  needs(requirements);

  await using app = await desktop({ name: "sidebar-ia-v2" });
  await createAndSelectWorkspace(app, {
    path: `/tmp/openwork-sidebar-ia-v2-${Date.now()}`,
  });

  // Frame 5 setup: start from Chinese so the zh → en switch is observable.
  await evalIn(app, `(() => {
    window.localStorage.setItem("openwork.language", "zh");
    return window.localStorage.getItem("openwork.language") === "zh";
  })()`).catch(() => undefined);
  // A reload re-runs initLocale() and paints the app in Chinese.
  await go(app, "/session");
  await evalIn(app, "location.reload(); true");
  await waitFor(app, `Boolean(document.querySelector('[data-sidebar-module-nav]'))`, {
    timeoutMs: 60_000,
    label: "module navigation group in the sidebar",
  });

  // Frame 2: eight destinations, in order, with the approved zh naming.
  await waitFor(app, `(() => {
    const nav = document.querySelector('[data-sidebar-module-nav]');
    if (!nav) return false;
    return (nav.textContent ?? '').includes('助理') && (nav.textContent ?? '').includes('自动化');
  })()`, {
    timeoutMs: 60_000,
    label: "Chinese module labels rendered after reload",
  });

  const zhLabels = labels(await evalIn(app, moduleNavLabels));
  const zhExpected = ["助理", "专家", "技能", "连接器", "资料库", "自动化", "项目", "灵感"];
  const zhAutomationsGated = zhLabels.filter((label) => label !== "自动化");
  const zhOrder = zhAutomationsGated.length === zhExpected.length - 1
    ? zhExpected.filter((label) => label !== "自动化")
    : zhExpected;
  expect(zhLabels).toEqual(zhOrder);
  evidence.recordAssertionEvidence(
    "The sidebar lists the eight module destinations in order with the approved Chinese names (Automations only on desktop with deployment enabled)",
    `module nav labels: ${JSON.stringify(zhLabels)}`,
    JSON.stringify(zhLabels) === JSON.stringify(zhOrder),
  );

  // Knowledge folded into Library and Collab removed: no such rows anywhere.
  const sidebarZhText = String(await evalIn(app, sidebarText) ?? "");
  expect(sidebarZhText.includes("知识库")).toBe(false);
  expect(sidebarZhText.includes("协作")).toBe(false);
  evidence.recordAssertionEvidence(
    "Knowledge and Collab no longer appear as sidebar destinations (Knowledge folded into Library)",
    `知识库 present=${sidebarZhText.includes("知识库")}, 协作 present=${sidebarZhText.includes("协作")}`,
    !sidebarZhText.includes("知识库") && !sidebarZhText.includes("协作"),
  );

  // Frame 5: switch zh → en through the appearance settings UI and observe the
  // sidebar relabel without a reload.
  await go(app, "/settings/appearance");
  await waitFor(app, `(() => {
    const trigger = document.querySelector('[aria-label="语言"], [aria-label="Language"]');
    if (!trigger) return false;
    trigger.click();
    return true;
  })()`, {
    timeoutMs: 60_000,
    label: "appearance language selector opened",
  });
  await waitFor(app, `(() => {
    const option = [...document.querySelectorAll('[role=option]')]
      .find((item) => (item.textContent ?? '').trim() === 'English');
    if (!option) return false;
    option.click();
    return true;
  })()`, {
    timeoutMs: 30_000,
    label: "English chosen in the language selector",
  });
  await waitFor(app, `(() => {
    const nav = document.querySelector('[data-sidebar-module-nav]');
    if (!nav) return false;
    return (nav.textContent ?? '').includes('Assistant');
  })()`, {
    timeoutMs: 30_000,
    label: "sidebar relabelled to English immediately after the switch",
  });

  const enLabels = labels(await evalIn(app, moduleNavLabels));
  const enExpected = ["Assistant", "Experts", "Skills", "Connectors", "Library", "Automations", "Projects", "Inspiration"];
  const enAutomationsGated = enLabels.filter((label) => label !== "Automations");
  const enOrder = enAutomationsGated.length === enExpected.length - 1
    ? enExpected.filter((label) => label !== "Automations")
    : enExpected;
  expect(enLabels).toEqual(enOrder);
  evidence.recordAssertionEvidence(
    "Switching the language to English relabels the sidebar instantly to Assistant/Experts/Skills/Connectors/Library/Automations/Projects/Inspiration",
    `module nav labels after switch: ${JSON.stringify(enLabels)}`,
    JSON.stringify(enLabels) === JSON.stringify(enOrder),
  );

  // Frame 6: Experts placeholder — concept + coming soon.
  await go(app, "/experts");
  await waitFor(app, `document.body.innerText.includes('Experts')`, {
    timeoutMs: 30_000,
    label: "Experts placeholder page title",
  });
  const expertsText = String(await evalIn(app, `document.body.innerText`) ?? "");
  const expertsExplainsIdentity = /identity|methodolog|专家|方法论/i.test(expertsText);
  const expertsExplainsTeam = /team|collaborat|团队|协同/i.test(expertsText);
  const expertsComingSoon = expertsText.includes("Coming soon");
  expect(expertsExplainsIdentity).toBe(true);
  expect(expertsExplainsTeam).toBe(true);
  expect(expertsComingSoon).toBe(true);
  evidence.recordAssertionEvidence(
    "The Experts placeholder explains the concept (identity + methodology, expert team collaboration) and states it is coming soon",
    `identity/methodology=${expertsExplainsIdentity}, team=${expertsExplainsTeam}, comingSoon=${expertsComingSoon}`,
    expertsExplainsIdentity && expertsExplainsTeam && expertsComingSoon,
  );

  // Frame 6: Inspiration placeholder — concept + coming soon.
  await go(app, "/inspiration");
  await waitFor(app, `document.body.innerText.includes('Inspiration')`, {
    timeoutMs: 30_000,
    label: "Inspiration placeholder page title",
  });
  const inspirationText = String(await evalIn(app, `document.body.innerText`) ?? "");
  const inspirationExplainsConcept = /one-click|reuse|reproduc|复刻|同款|一键/i.test(inspirationText);
  const inspirationComingSoon = inspirationText.includes("Coming soon");
  expect(inspirationExplainsConcept).toBe(true);
  expect(inspirationComingSoon).toBe(true);
  evidence.recordAssertionEvidence(
    "The Inspiration placeholder explains the one-click remake concept and states it is coming soon",
    `concept=${inspirationExplainsConcept}, comingSoon=${inspirationComingSoon}`,
    inspirationExplainsConcept && inspirationComingSoon,
  );

  // Visual confirmation of frames 2 and 6.
  await go(app, "/experts");
  await waitFor(app, `Boolean(document.querySelector('[data-module-placeholder="experts"]'))`, {
    timeoutMs: 30_000,
    label: "experts placeholder marker",
  });
  {
    const shot = await screenshot(app);
    const seen = await validate(shot, [
      "The left sidebar lists Assistant, Experts, Skills, Connectors, Library, Projects and Inspiration as module rows",
      "The main area shows the Experts placeholder with a description of what experts are and a coming soon notice",
      "No error dialog or crash message is visible",
    ]);
    expect(seen.ok, seen.why).toBe(true);
    await evidence.recordScreenshot(shot);
  }
});
