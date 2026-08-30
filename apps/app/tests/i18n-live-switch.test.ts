import { describe, expect, test } from "bun:test";

import { getLocaleVersion, setLocale, subscribeLocale, t } from "../src/i18n";

describe("i18n 即时生效（响应式订阅）", () => {
  test("setLocale 递增版本号并通知订阅者", () => {
    setLocale("en");
    const before = getLocaleVersion();
    let notified = 0;
    const unsubscribe = subscribeLocale(() => {
      notified += 1;
    });
    try {
      setLocale("zh");
      expect(notified).toBe(1);
      expect(getLocaleVersion()).toBe(before + 1);
    } finally {
      unsubscribe();
    }
  });

  test("setLocale 后 t() 立即返回新语言文案", () => {
    setLocale("en");
    expect(t("sidebar.projects")).toBe("Projects");
    setLocale("zh");
    expect(t("sidebar.projects")).toBe("项目");
    setLocale("en");
    expect(t("sidebar.projects")).toBe("Projects");
  });

  test("新 key（sidebar.assistant 等）在切换语言后即时生效", () => {
    setLocale("en");
    expect(t("sidebar.assistant")).toBe("Assistant");
    expect(t("sidebar.library")).toBe("Library");
    setLocale("zh");
    expect(t("sidebar.assistant")).toBe("助理");
    expect(t("sidebar.library")).toBe("资料库");
    setLocale("en");
  });

  test("取消订阅后不再收到通知", () => {
    setLocale("en");
    let notified = 0;
    const unsubscribe = subscribeLocale(() => {
      notified += 1;
    });
    unsubscribe();
    setLocale("zh");
    expect(notified).toBe(0);
    setLocale("en");
  });

  test("订阅支持多监听者", () => {
    setLocale("en");
    let first = 0;
    let second = 0;
    const unsubA = subscribeLocale(() => {
      first += 1;
    });
    const unsubB = subscribeLocale(() => {
      second += 1;
    });
    try {
      setLocale("zh");
      expect(first).toBe(1);
      expect(second).toBe(1);
      unsubA();
      setLocale("en");
      expect(first).toBe(1);
      expect(second).toBe(2);
    } finally {
      unsubA();
      unsubB();
    }
  });
});
