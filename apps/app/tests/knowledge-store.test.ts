import "./_setup/localstorage";
import { afterEach, describe, expect, test } from "bun:test";

import { PERSISTED_KNOWLEDGE_KEY, useKnowledgeStore } from "../src/react-app/domains/knowledge/knowledge-store";

function resetStore() {
  // Zustand persist reads from localStorage on first import; clear both the
  // persisted state and the in-memory store so each test starts from zero.
  try {
    globalThis.localStorage.removeItem(PERSISTED_KNOWLEDGE_KEY);
  } catch {}
  useKnowledgeStore.setState({ items: [] });
}

afterEach(() => {
  resetStore();
});

describe("knowledge store create/update/delete", () => {
  test("createKnowledge returns a new id and stores a trimmed item with matching createdAt/updatedAt", () => {
    const id = useKnowledgeStore.getState().createKnowledge(
      "  Flight bookings  ",
      "  Notes on QR codes  ",
      "  passenger: Yason\nrow: 12  ",
      "text",
    );
    expect(typeof id).toBe("string");
    expect(id.length > 0).toBe(true);

    const item = useKnowledgeStore.getState().items.find((x) => x.id === id);
    expect(item).toBeDefined();
    if (!item) return;
    expect(item.title).toBe("Flight bookings");
    expect(item.description).toBe("Notes on QR codes");
    expect(item.content).toBe("passenger: Yason\nrow: 12");
    expect(item.sourceType).toBe("text");
    expect(item.createdAt).toBe(item.updatedAt);
  });

  test("createKnowledge with empty title still creates (store does not validate; UI does)", () => {
    // The store intentionally allows any string; validation is at the dialog
    // layer. Verify this so a future refactor doesn't silently start
    // rejecting entries the UI used to permit.
    const id = useKnowledgeStore.getState().createKnowledge("", "", "", "text");
    const item = useKnowledgeStore.getState().items.find((x) => x.id === id);
    expect(item?.title).toBe("");
    expect(item?.description).toBe("");
    expect(item?.content).toBe("");
  });

  test("createKnowledge with file source type preserves the sourceType", () => {
    const id = useKnowledgeStore.getState().createKnowledge("README.md", "", "# hi", "file");
    const item = useKnowledgeStore.getState().items.find((x) => x.id === id);
    expect(item?.sourceType).toBe("file");
  });

  test("updateKnowledge patches only the specified fields and bumps updatedAt", () => {
    const id = useKnowledgeStore.getState().createKnowledge("Title", "Desc", "Body", "text");
    const before = useKnowledgeStore.getState().items.find((x) => x.id === id);
    // Wait a tick so updatedAt can diverge if the clock has ms resolution.
    const later = new Date(before!.updatedAt);
    later.setMilliseconds(later.getMilliseconds() + 10);
    // Force a distinct timestamp by mocking Date briefly.
    const realDate = globalThis.Date;
    const fakeNow = later.toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Date = class extends realDate {
      constructor() {
        super();
        return new realDate(fakeNow);
      }
      static now() {
        return new realDate(fakeNow).getTime();
      }
    };
    try {
      useKnowledgeStore.getState().updateKnowledge(id, { title: "New Title" });
    } finally {
      globalThis.Date = realDate;
    }
    const after = useKnowledgeStore.getState().items.find((x) => x.id === id);
    expect(after?.title).toBe("New Title");
    expect(after?.description).toBe("Desc"); // unchanged
    expect(after?.content).toBe("Body"); // unchanged
    expect(after?.updatedAt).toBe(fakeNow);
    expect(after?.createdAt).toBe(before?.createdAt);
  });

  test("updateKnowledge on a non-existent id is a no-op (no throw, no items added)", () => {
    const beforeCount = useKnowledgeStore.getState().items.length;
    expect(() => useKnowledgeStore.getState().updateKnowledge("does-not-exist", { title: "x" })).not.toThrow();
    expect(useKnowledgeStore.getState().items.length).toBe(beforeCount);
  });

  test("updateKnowledge can switch sourceType from text to file and back", () => {
    const id = useKnowledgeStore.getState().createKnowledge("t", "d", "c", "text");
    useKnowledgeStore.getState().updateKnowledge(id, { sourceType: "file" });
    expect(useKnowledgeStore.getState().items.find((x) => x.id === id)?.sourceType).toBe("file");
    useKnowledgeStore.getState().updateKnowledge(id, { sourceType: "text" });
    expect(useKnowledgeStore.getState().items.find((x) => x.id === id)?.sourceType).toBe("text");
  });

  test("deleteKnowledge removes the matching id and leaves others untouched", () => {
    const a = useKnowledgeStore.getState().createKnowledge("A", "", "", "text");
    const b = useKnowledgeStore.getState().createKnowledge("B", "", "", "text");
    const c = useKnowledgeStore.getState().createKnowledge("C", "", "", "text");
    useKnowledgeStore.getState().deleteKnowledge(b);
    const ids = useKnowledgeStore.getState().items.map((x) => x.id);
    expect(ids).toEqual([a, c]);
  });

  test("deleteKnowledge on a non-existent id is a no-op", () => {
    useKnowledgeStore.getState().createKnowledge("A", "", "", "text");
    expect(() => useKnowledgeStore.getState().deleteKnowledge("missing")).not.toThrow();
    expect(useKnowledgeStore.getState().items.length).toBe(1);
  });

  test("deleting then recreating produces a different id (no id reuse)", () => {
    const firstId = useKnowledgeStore.getState().createKnowledge("A", "", "", "text");
    useKnowledgeStore.getState().deleteKnowledge(firstId);
    const secondId = useKnowledgeStore.getState().createKnowledge("A", "", "", "text");
    expect(secondId).not.toBe(firstId);
  });

  test("persistence: created items round-trip through localStorage", () => {
    const id = useKnowledgeStore.getState().createKnowledge("Persisted", "d", "c", "text");
    const raw = window.localStorage.getItem(PERSISTED_KNOWLEDGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.items).toHaveLength(1);
    expect(parsed.state.items[0].id).toBe(id);
  });

  test("批量创建后 items 数量正确", () => {
    for (let i = 0; i < 50; i++) {
      useKnowledgeStore.getState().createKnowledge(`Item ${i}`, "", "", "text");
    }
    expect(useKnowledgeStore.getState().items.length).toBe(50);
  });

  test("批量创建后全部删除，items 为空", () => {
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      ids.push(useKnowledgeStore.getState().createKnowledge(`Item ${i}`, "", "", "text"));
    }
    for (const id of ids) {
      useKnowledgeStore.getState().deleteKnowledge(id);
    }
    expect(useKnowledgeStore.getState().items.length).toBe(0);
  });

  test("中文/emoji 内容正常存储和读取", () => {
    const id = useKnowledgeStore.getState().createKnowledge(
      "飞书机器人 🤖",
      "支持消息接收和回复",
      "# 配置说明\n- Step 1: 注册应用\n- Step 2: 配置 webhook 📡",
      "text",
    );
    const item = useKnowledgeStore.getState().items.find((x) => x.id === id);
    expect(item?.title).toBe("飞书机器人 🤖");
    expect(item?.description).toBe("支持消息接收和回复");
    expect(item?.content).toContain("📡");
  });

  test("超长内容正常存储（10KB）", () => {
    const longContent = "x".repeat(10_000);
    const id = useKnowledgeStore.getState().createKnowledge("Long", "", longContent, "text");
    const item = useKnowledgeStore.getState().items.find((x) => x.id === id);
    expect(item?.content.length).toBe(10_000);
  });

  test("createKnowledge 每次返回唯一的 id（UUID 格式）", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      ids.add(useKnowledgeStore.getState().createKnowledge(`Item ${i}`, "", "", "text"));
    }
    expect(ids.size).toBe(20); // 全部唯一
    // UUID v4 格式检查
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  test("createdAt 和 updatedAt 是 ISO 8601 字符串", () => {
    const id = useKnowledgeStore.getState().createKnowledge("T", "D", "C", "text");
    const item = useKnowledgeStore.getState().items.find((x) => x.id === id)!;
    // ISO 8601 格式: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(item.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(item.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test("updateKnowledge 用空 patch 不改变任何字段", () => {
    const id = useKnowledgeStore.getState().createKnowledge("Title", "Desc", "Body", "text");
    useKnowledgeStore.getState().updateKnowledge(id, {});
    const item = useKnowledgeStore.getState().items.find((x) => x.id === id)!;
    expect(item.title).toBe("Title");
    expect(item.description).toBe("Desc");
    expect(item.content).toBe("Body");
  });

  test("updateKnowledge title 为空字符串（清空）", () => {
    const id = useKnowledgeStore.getState().createKnowledge("Title", "Desc", "Body", "text");
    useKnowledgeStore.getState().updateKnowledge(id, { title: "" });
    const item = useKnowledgeStore.getState().items.find((x) => x.id === id)!;
    expect(item.title).toBe("");
    expect(item.description).toBe("Desc"); // unchanged
  });

  test("persistence: 多个 items 全部 round-trip", () => {
    const a = useKnowledgeStore.getState().createKnowledge("A", "da", "ca", "text");
    const b = useKnowledgeStore.getState().createKnowledge("B", "db", "cb", "file");
    useKnowledgeStore.getState().deleteKnowledge(a);
    const raw = window.localStorage.getItem(PERSISTED_KNOWLEDGE_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed.state.items).toHaveLength(1);
    expect(parsed.state.items[0].id).toBe(b);
    expect(parsed.state.items[0].sourceType).toBe("file");
  });

  test("persistence: 删除所有 items 后 localStorage 为空数组", () => {
    const id = useKnowledgeStore.getState().createKnowledge("X", "", "", "text");
    useKnowledgeStore.getState().deleteKnowledge(id);
    const raw = window.localStorage.getItem(PERSISTED_KNOWLEDGE_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed.state.items).toHaveLength(0);
  });
});
