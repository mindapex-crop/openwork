import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  hideDeveloperElements,
  isWorkMode,
  readWorkMode,
  WORK_MODE_KEY,
  WORK_MODE_VALUES,
  writeWorkMode,
} from "../src/react-app/domains/onboarding/work-mode";

// work-mode 通过 window.localStorage 读写；bun test 无 window 全局，这里提供内存实现。
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

let originalWindow: unknown;
beforeAll(() => {
  originalWindow = (globalThis as Record<string, unknown>).window;
  (globalThis as Record<string, unknown>).window = {
    localStorage: new MemoryStorage(),
  };
});
afterAll(() => {
  if (originalWindow === undefined) {
    delete (globalThis as Record<string, unknown>).window;
  } else {
    (globalThis as Record<string, unknown>).window = originalWindow;
  }
});

describe("工作模式（WorkBuddy 对标：日常办公/代码开发/设计创意）", () => {
  test("默认工作模式为代码开发", () => {
    window.localStorage.removeItem(WORK_MODE_KEY);
    expect(readWorkMode()).toBe("code");
  });

  test("选择结果写入 localStorage 并可读回", () => {
    writeWorkMode("daily");
    expect(window.localStorage.getItem(WORK_MODE_KEY)).toBe("daily");
    expect(readWorkMode()).toBe("daily");

    writeWorkMode("design");
    expect(readWorkMode()).toBe("design");

    writeWorkMode("code");
    expect(readWorkMode()).toBe("code");
  });

  test("非法值回退到默认代码开发", () => {
    window.localStorage.setItem(WORK_MODE_KEY, "unknown-mode");
    expect(isWorkMode("unknown-mode")).toBe(false);
    expect(readWorkMode()).toBe("code");
    expect(WORK_MODE_VALUES).toEqual(["daily", "code", "design"]);
  });

  test("日常办公模式隐藏开发者元素，代码开发/设计创意不隐藏", () => {
    writeWorkMode("daily");
    expect(hideDeveloperElements()).toBe(true);

    writeWorkMode("code");
    expect(hideDeveloperElements()).toBe(false);

    writeWorkMode("design");
    expect(hideDeveloperElements()).toBe(false);
  });
});
