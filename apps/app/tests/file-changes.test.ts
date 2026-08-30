/**
 * 变更面板 —— 从会话消息中提取"文件修改记录"（WorkBuddy 右侧"变更"区对标）。
 */
import { describe, expect, test } from "bun:test";

import type { UIMessage } from "ai";

import { deriveFileChanges } from "../src/react-app/domains/session/artifacts/open-target";

function toolMessage(toolName: string, input: unknown, output?: unknown): UIMessage {
  return {
    id: `msg-${toolName}-${Math.random()}`,
    role: "assistant",
    content: "",
    parts: [
      {
        type: "dynamic-tool",
        toolName,
        toolCallId: `call-${toolName}`,
        state: "output-available",
        input: input as never,
        output,
      } as UIMessage["parts"][number],
    ],
  };
}

describe("deriveFileChanges —— 从消息提取文件修改记录", () => {
  test("write 类工具调用生成 create 变更", () => {
    const messages = [toolMessage("write", { filePath: "docs/report.md", content: "# hi" })];
    const changes = deriveFileChanges(messages);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ path: "docs/report.md", action: "create" });
  });

  test("edit 类工具调用生成 edit 变更", () => {
    const messages = [toolMessage("edit", { filePath: "src/app.ts", oldString: "a", newString: "b" })];
    const changes = deriveFileChanges(messages);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ path: "src/app.ts", action: "edit" });
  });

  test("apply_patch 从 patchText 提取 Add File / Update File 路径", () => {
    const patchText = "*** Add File: new/hello.ts\n+export const x = 1;\n*** Update File: src/lib/util.ts\n- old\n+new";
    const messages = [toolMessage("apply_patch", { patchText })];
    const changes = deriveFileChanges(messages);
    expect(changes.map((change) => change.path).sort()).toEqual([
      "new/hello.ts",
      "src/lib/util.ts",
    ]);
  });

  test("同一文件的多次变更按时间序保留最新一条", () => {
    const messages = [
      toolMessage("write", { filePath: "a.ts" }),
      toolMessage("edit", { filePath: "a.ts" }),
    ];
    const changes = deriveFileChanges(messages);
    expect(changes).toHaveLength(1);
    expect(changes[0].action).toBe("edit");
  });

  test("非写类工具（glob / grep）不产生变更", () => {
    const messages = [
      toolMessage("glob", { pattern: "**/*.ts" }),
      toolMessage("grep", { pattern: "foo" }),
    ];
    expect(deriveFileChanges(messages)).toHaveLength(0);
  });

  test("空消息列表返回空数组", () => {
    expect(deriveFileChanges([])).toEqual([]);
  });
});
