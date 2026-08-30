/** @jsxImportSource react */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AutomationBuilder } from "../src/react-app/domains/browser/automation-builder";

function textOf(markup: string) {
  return markup.replace(/<[^>]*>/g, "|").replace(/\|+/g, "|");
}

function buttonMarkup(markup: string, label: string) {
  return (
    [...markup.matchAll(/<button[\s\S]*?<\/button>/g)]
      .map((match) => match[0])
      .find((button) => textOf(button).includes(`|${label}`)) ?? ""
  );
}

describe("AutomationBuilder", () => {
  test("exposes the script controls before any step exists", () => {
    const markup = renderToStaticMarkup(<AutomationBuilder />);

    expect(buttonMarkup(markup, "加载")).not.toBe("");
    expect(buttonMarkup(markup, "保存")).not.toBe("");
    expect(buttonMarkup(markup, "清空")).not.toBe("");
    expect(markup).toContain('placeholder="脚本名称..."');
  });

  test("starts on the empty state with nothing counted in a footer", () => {
    const markup = renderToStaticMarkup(<AutomationBuilder />);
    const text = textOf(markup);

    expect(text).toContain("还没有添加任何步骤。点击下方按钮开始构建自动化脚本。");
    expect(text).toContain("添加第一个步骤");
    expect(text).not.toContain("|步骤 1");
    expect(text).not.toContain("共 ");
  });

  test("refuses to run an automation with no steps", () => {
    const run = buttonMarkup(renderToStaticMarkup(<AutomationBuilder />), "运行自动化");

    expect(run).toContain("disabled=");
  });
});
