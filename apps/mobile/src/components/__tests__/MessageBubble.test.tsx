import React from "react";
import { create, act, type ReactTestRenderer } from "react-test-renderer";

import { MessageBubble } from "../MessageBubble";
import type { SessionMessage } from "../../types";

function render(message: SessionMessage): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<MessageBubble message={message} />);
  });
  return renderer;
}

describe("MessageBubble", () => {
  it("渲染用户消息文本", () => {
    const message: SessionMessage = {
      info: { id: "m1", sessionID: "s1", role: "user", time: { created: 1_700_000_000_000 } },
      parts: [{ id: "p1", messageID: "m1", sessionID: "s1", type: "text", text: "你好" }],
    };
    const renderer = render(message);
    const texts = renderer.root.findAll((node) => node.type === "Text" && node.props.children === "你好");
    expect(texts.length).toBeGreaterThan(0);
  });

  it("渲染助手消息文本", () => {
    const message: SessionMessage = {
      info: { id: "m2", sessionID: "s1", role: "assistant", time: { created: 1_700_000_000_000 } },
      parts: [
        { id: "p1", messageID: "m2", sessionID: "s1", type: "text", text: "收到！" },
        { id: "p2", messageID: "m2", sessionID: "s1", type: "tool" },
      ],
    };
    const renderer = render(message);
    const texts = renderer.root.findAll((node) => node.type === "Text" && node.props.children === "收到！");
    expect(texts.length).toBeGreaterThan(0);
  });

  it("无文本 part 时渲染占位符", () => {
    const message: SessionMessage = {
      info: { id: "m3", sessionID: "s1", role: "assistant" },
      parts: [{ id: "p1", messageID: "m3", sessionID: "s1", type: "tool" }],
    };
    const renderer = render(message);
    const dots = renderer.root.findAll((node) => node.type === "Text" && node.props.children === "…");
    expect(dots.length).toBeGreaterThan(0);
  });
});
