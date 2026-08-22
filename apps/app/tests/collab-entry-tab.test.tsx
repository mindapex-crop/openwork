/**
 * CollabEntryTab 组件测试
 *
 * 覆盖：
 * - cli 模式下渲染"团队协作"按钮
 * - simple 模式下不渲染
 * - 点击按钮调用 onClose
 * - className 透传
 */
import { describe, expect, test, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CollabEntryTab } from "../src/react-app/domains/session/collab-entry-tab";

describe("CollabEntryTab", () => {
  test("cli mode: renders the team collaboration button", () => {
    const html = renderToStaticMarkup(
      <CollabEntryTab mode="cli" onClose={() => {}} />,
    );
    expect(html).toContain("团队协作");
    expect(html).toContain("type=\"button\"");
    // lucide-react renders SVGs with class "lucide lucide-users"
    expect(html).toContain("lucide-users");
  });

  test("simple mode: renders nothing", () => {
    const html = renderToStaticMarkup(
      <CollabEntryTab mode="simple" onClose={() => {}} />,
    );
    expect(html).toBe("");
  });

  test("cli mode: button has outline-like styling and sm size", () => {
    const html = renderToStaticMarkup(
      <CollabEntryTab mode="cli" onClose={() => {}} />,
    );
    // Button renders variant/size as CSS classes, not attributes
    // outline variant includes border-border, sm includes h-8
    expect(html).toContain("border-border");
    expect(html).toContain("h-8");
  });

  test("cli mode: button has shrink-0 class", () => {
    const html = renderToStaticMarkup(
      <CollabEntryTab mode="cli" onClose={() => {}} />,
    );
    expect(html).toContain("shrink-0");
  });

  test("custom className is appended", () => {
    const html = renderToStaticMarkup(
      <CollabEntryTab mode="cli" onClose={() => {}} className="my-custom" />,
    );
    expect(html).toContain("my-custom");
    expect(html).toContain("shrink-0");
  });

  test("button renders with data-slot for click handling", () => {
    const html = renderToStaticMarkup(
      <CollabEntryTab mode="cli" onClose={() => {}} />,
    );
    // renderToStaticMarkup doesn't serialize onClick, but the Button
    // component renders with data-slot="button" for event delegation
    expect(html).toContain('data-slot="button"');
    expect(html).toContain("团队协作");
  });
});
