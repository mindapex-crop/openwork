import React from "react";
import { create, act, type ReactTestRenderer } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { RetryBanner } from "../RetryBanner";
import { LanguageProvider } from "../../i18n";
import { ApiError } from "../../api/client";

async function render(el: React.ReactElement): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<LanguageProvider>{el}</LanguageProvider>);
    // flush AsyncStorage.getItem 的 promise，使 hydrated=true
    await Promise.resolve();
    await Promise.resolve();
  });
  return renderer;
}

function findText(renderer: ReactTestRenderer, text: string): boolean {
  return (
    renderer.root.findAll((node) => node.type === "Text" && String(node.props.children).includes(text)).length > 0
  );
}

describe("RetryBanner", () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it("网络错误显示离线提示文案（zh）", async () => {
    await AsyncStorage.setItem("openwork.mobile.lang", "zh");
    const renderer = await render(
      <RetryBanner error={new ApiError(0, "network_error", "boom")} onRetry={jest.fn()} />,
    );
    expect(findText(renderer, "无法连接服务器")).toBe(true);
    expect(findText(renderer, "重试")).toBe(true);
  });

  it("网络错误显示离线提示文案（en，默认跟随系统）", async () => {
    const renderer = await render(
      <RetryBanner error={new ApiError(0, "network_error", "boom")} onRetry={jest.fn()} />,
    );
    expect(findText(renderer, "Cannot reach the server")).toBe(true);
    expect(findText(renderer, "Retry")).toBe(true);
  });

  it("业务错误显示错误信息", async () => {
    const renderer = await render(
      <RetryBanner error={new ApiError(500, "server_error", "Server exploded")} onRetry={jest.fn()} />,
    );
    expect(findText(renderer, "Server exploded")).toBe(true);
  });

  it("无错误时不渲染", async () => {
    const renderer = await render(<RetryBanner error={null} onRetry={jest.fn()} />);
    expect(renderer.toJSON()).toBeNull();
  });
});
