/**
 * ExpertStore 测试 - 专家定义仓储（文件式）
 */
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExpertStore, type ExpertCreateInput } from "./expert-store.js";

let dir: string;
let store: ExpertStore;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "expert-store-"));
  store = new ExpertStore(dir);
  await store.init();
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

function sampleInput(overrides: Partial<ExpertCreateInput> = {}): ExpertCreateInput {
  return {
    name: "架构专家",
    description: "系统架构设计专家",
    systemPrompt: "你是资深架构师，擅长系统设计。",
    methodology: "先分析需求，再输出架构方案，最后给出实施计划。",
    skills: ["architecture", "system-design"],
    model: "anthropic/claude-opus-4",
    avatar: "🏛️",
    agentId: "opencode",
    role: "specialist",
    ...overrides,
  };
}

describe("ExpertStore CRUD", () => {
  test("create 生成 id 并保存到文件（slugify 名称）", async () => {
    const expert = await store.create(sampleInput());
    expect(expert.id).toBe("架构专家"); // 中文名保留
    expect(expert.name).toBe("架构专家");
    expect(expert.systemPrompt).toContain("架构");
    expect(expert.methodology).toContain("先分析需求");
    expect(expert.skills).toEqual(["architecture", "system-design"]);
    expect(expert.model).toBe("anthropic/claude-opus-4");
    expect(expert.avatar).toBe("🏛️");
    expect(expert.agentId).toBe("opencode");
    expect(expert.role).toBe("specialist");
    expect(expert.createdAt).toBeDefined();
    expect(expert.updatedAt).toBeDefined();
    expect(expert.source).toBe("local");
    expect(expert.path).toContain("expert.md");
  });

  test("get 读取已保存的专家", async () => {
    const created = await store.create(sampleInput({ name: "测试专家A" }));
    const got = await store.get(created.id);
    expect(got).not.toBeNull();
    expect(got!.name).toBe("测试专家A");
    expect(got!.systemPrompt).toBe(sampleInput().systemPrompt);
  });

  test("get 不存在的 id 返回 null", async () => {
    expect(await store.get("no-such-expert")).toBeNull();
  });

  test("list 返回全部专家（按名称排序）", async () => {
    await store.create(sampleInput({ name: "B专家" }));
    await store.create(sampleInput({ name: "A专家" }));
    const experts = await store.list();
    const names = experts.map((e) => e.name);
    expect(names).toContain("B专家");
    expect(names).toContain("A专家");
    // 排序检查：A 在 B 前
    expect(names.indexOf("A专家")).toBeLessThan(names.indexOf("B专家"));
  });

  test("update 部分字段更新，未提供字段保留", async () => {
    const created = await store.create(sampleInput({ name: "待更新专家" }));
    const updated = await store.update(created.id, {
      methodology: "新的方法论",
      model: "deepseek/deepseek-coder",
    });
    expect(updated).not.toBeNull();
    expect(updated!.methodology).toBe("新的方法论");
    expect(updated!.model).toBe("deepseek/deepseek-coder");
    expect(updated!.name).toBe("待更新专家"); // 未提供则保留
    expect(updated!.skills).toEqual(["architecture", "system-design"]);
  });

  test("update 不存在的 id 返回 null", async () => {
    expect(await store.update("missing-id", { name: "x" })).toBeNull();
  });

  test("delete 删除专家且再次 get 返回 null", async () => {
    const created = await store.create(sampleInput({ name: "待删除专家" }));
    expect(await store.delete(created.id)).toBe(true);
    expect(await store.get(created.id)).toBeNull();
    expect(await store.delete(created.id)).toBe(false);
  });

  test("默认 agentId 回退为 name slug", async () => {
    const created = await store.create(sampleInput({ agentId: undefined }));
    expect(created.agentId).toBe("架构专家");
  });

  test("defaults: 未提供的可选字段有默认值", async () => {
    const created = await store.create({
      name: "极简专家",
      systemPrompt: "prompt body",
    });
    expect(created.description).toBe("");
    expect(created.methodology).toBe("");
    expect(created.skills).toEqual([]);
    expect(created.role).toBeUndefined();
    expect(created.model).toBeUndefined();
    expect(created.avatar).toBeUndefined();
  });

  test("toTeamMember 转为 AgentTeamMember（adapter 注入）", async () => {
    const created = await store.create(sampleInput({ name: "转换专家" }));
    const adapter = { agentId: "opencode" } as never;
    const member = store.toTeamMember(created, adapter);
    expect(member.agentId).toBe("opencode");
    expect(member.adapter).toBe(adapter);
    expect(member.role).toBe("specialist");
  });
});
