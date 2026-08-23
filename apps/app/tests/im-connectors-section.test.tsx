/**
 * ImConnectorsSection 组件测试
 *
 * 覆盖：
 * - 渲染所有 5 个平台（飞书、企业微信、钉钉、Slack、Discord）
 * - 每个平台显示正确的名称和描述
 * - 初始状态全部为"未连接"
 * - 连接/断开按钮的存在
 * - 摘要计数器
 * - 文档链接
 * - 自定义 Webhook 按钮（disabled）
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ImConnectorsSection } from "../src/react-app/domains/settings/im-connectors-section";

describe("ImConnectorsSection", () => {
  const html = renderToStaticMarkup(<ImConnectorsSection />);

  test("renders the section title 'IM Integration'", () => {
    expect(html).toContain("IM Integration");
  });

  test("renders summary badge showing 0/5 connected initially", () => {
    expect(html).toContain("0 / 5 connected");
  });

  test("renders all 5 platform names", () => {
    expect(html).toContain("飞书");
    expect(html).toContain("企业微信");
    expect(html).toContain("钉钉");
    expect(html).toContain("Slack");
    expect(html).toContain("Discord");
  });

  test("each platform has a description", () => {
    expect(html).toContain("通过飞书机器人接收消息");
    expect(html).toContain("接入企业微信应用");
    expect(html).toContain("通过钉钉连接器");
    expect(html).toContain("在 Slack 频道中");
    expect(html).toContain("Discord Bot 集成");
  });

  test("all platforms show 'Disconnected' status initially", () => {
    const matches = html.match(/Disconnected/gi);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(5);
  });

  test("each disconnected platform shows 'Connect' button", () => {
    const connectMatches = html.match(/>Connect</g);
    expect(connectMatches).not.toBeNull();
    expect(connectMatches!.length).toBe(5);
  });

  test("each platform has a documentation link", () => {
    expect(html).toContain("open.feishu.cn");
    expect(html).toContain("developer.work.weixin.qq.com");
    expect(html).toContain("open.dingtalk.com");
    expect(html).toContain("api.slack.com");
    expect(html).toContain("discord.com/developers");
  });

  test("documentation links open in new tab", () => {
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });

  test("custom webhook button is disabled (coming soon)", () => {
    expect(html).toContain("Custom Webhook");
    expect(html).toContain("disabled");
  });

  test("description text explains the feature", () => {
    expect(html).toContain("Connect OpenWork Agent to messaging platforms");
    expect(html).toContain("Complete the setup after configuring app credentials");
  });

  test("each platform card has an icon container with accent color", () => {
    expect(html).toContain("bg-indigo-500");   // feishu
    expect(html).toContain("bg-sky-500");       // wecom
    expect(html).toContain("bg-violet-500");    // dingtalk
    expect(html).toContain("bg-rose-500");      // slack
    expect(html).toContain("bg-indigo-600");    // discord
  });

  test("no re-sync or disconnect buttons when all are disconnected", () => {
    // 断开按钮只在 connected 状态显示
    expect(html).not.toContain("断开");
    expect(html).not.toContain("重新同步");
  });
});
