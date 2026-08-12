import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EMPTY_SPACE_DATA,
  normalizeSpaceData,
  readSpaceData,
  updateSpaceData,
  writeSpaceData,
} from "./space-store.js";
import type { ServerConfig } from "./types.js";

const WORKSPACE_ID = "ws_space_store";
const roots: string[] = [];
const previousRuntimeDb = process.env.OPENWORK_RUNTIME_DB;

afterEach(async () => {
  while (roots.length) {
    const root = roots.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
  if (previousRuntimeDb === undefined) delete process.env.OPENWORK_RUNTIME_DB;
  else process.env.OPENWORK_RUNTIME_DB = previousRuntimeDb;
});

async function tempConfig(): Promise<ServerConfig> {
  const root = await mkdtemp(join(tmpdir(), "openwork-space-store-"));
  roots.push(root);
  process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
  return {
    host: "127.0.0.1",
    port: 0,
    token: "token",
    hostToken: "host-token",
    configPath: join(root, "server.json"),
    approval: { mode: "auto", timeoutMs: 0 },
    corsOrigins: [],
    workspaces: [{ id: WORKSPACE_ID, name: "Test", path: root, preset: "starter", workspaceType: "local" }],
    authorizedRoots: [root],
    readOnly: false,
    startedAt: Date.now(),
    tokenSource: "generated",
    hostTokenSource: "generated",
    logFormat: "pretty",
    logRequests: false,
  };
}

describe("space store", () => {
  test("returns empty defaults for a missing row", async () => {
    const config = await tempConfig();
    const { data, updatedAt } = await readSpaceData(config, WORKSPACE_ID);
    expect(data).toEqual(EMPTY_SPACE_DATA);
    expect(updatedAt).toBeNull();
  });

  test("writes, reads, and round-trips space data", async () => {
    const config = await tempConfig();
    const written = await writeSpaceData(config, WORKSPACE_ID, {
      settings: { name: "My Space", description: "A space", skills: ["alpha", "beta"], env: { KEY: "value" } },
      plans: [{ id: "plan_1", title: "Plan", detail: "Details", status: "active", updatedAt: 42 }],
      tasks: [{ id: "task_1", title: "Task", status: "doing", priority: "high", updatedAt: 43 }],
    });
    expect(written.data.settings.name).toBe("My Space");
    expect(written.data.plans).toHaveLength(1);
    expect(written.data.tasks).toHaveLength(1);

    const { data, updatedAt } = await readSpaceData(config, WORKSPACE_ID);
    expect(data).toEqual(written.data);
    expect(updatedAt).toBe(written.updatedAt);
  });

  test("normalizes malformed input instead of throwing", () => {
    expect(normalizeSpaceData(null)).toEqual(EMPTY_SPACE_DATA);
    expect(normalizeSpaceData(undefined)).toEqual(EMPTY_SPACE_DATA);
    expect(normalizeSpaceData("junk")).toEqual(EMPTY_SPACE_DATA);
    const normalized = normalizeSpaceData({
      settings: { name: 123, skills: "not-an-array", env: [{ bad: true }] },
      plans: [{ id: "p", title: "  " }],
      tasks: [{ id: "t", title: "Ok", status: "bogus", priority: "bogus" }],
    });
    expect(normalized.settings.name).toBe("");
    expect(normalized.settings.skills).toEqual([]);
    expect(normalized.settings.env).toEqual({});
    expect(normalized.plans).toEqual([]);
    expect(normalized.tasks).toEqual([
      { id: "t", title: "Ok", status: "todo", priority: "low", updatedAt: expect.any(Number) },
    ]);
  });

  test("updateSpaceData merges only provided sections via updater", async () => {
    const config = await tempConfig();
    await writeSpaceData(config, WORKSPACE_ID, {
      settings: { name: "A", description: "", skills: [], env: {} },
      plans: [{ id: "plan_a", title: "A", detail: "", status: "backlog", updatedAt: 1 }],
      tasks: [],
    });

    const patched = await updateSpaceData(config, WORKSPACE_ID, (current) => ({
      ...current,
      tasks: [{ id: "task_x", title: "X", status: "todo", priority: "medium", updatedAt: 2 }],
    }));
    expect(patched.data.plans).toHaveLength(1);
    expect(patched.data.tasks).toHaveLength(1);

    const { data } = await readSpaceData(config, WORKSPACE_ID);
    expect(data.settings.name).toBe("A");
    expect(data.tasks[0]?.id).toBe("task_x");
  });

  test("serializes concurrent read-modify-write updates per workspace", async () => {
    const config = await tempConfig();
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        updateSpaceData(config, WORKSPACE_ID, (current) => ({
          ...current,
          tasks: [
            ...current.tasks,
            { id: `task_${index}`, title: `T${index}`, status: "todo", priority: "low", updatedAt: index },
          ],
        })),
      ),
    );
    const { data } = await readSpaceData(config, WORKSPACE_ID);
    expect(data.tasks).toHaveLength(8);
  });
});
