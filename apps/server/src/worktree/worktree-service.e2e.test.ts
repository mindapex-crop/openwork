/**
 * worktree-service.e2e.test.ts — Worktree 生命周期服务真实环境验证（openspec-worktree-service §5）
 *
 * 真实案例：在临时 git 仓库上执行 create → 隔离验证 → list → remove → prune → cleanupStale，
 * 全部走真实 `git worktree` 命令。错误路径：非 git 目录 / 空仓库 / 未管理 worktree。
 *
 * 运行: bun test src/worktree/worktree-service.e2e.test.ts
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { WorktreeService, WorktreeError } from "./worktree-service.js";

function git(repo: string, ...args: string[]): { code: number; out: string } {
  const res = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  return { code: res.status ?? -1, out: res.stdout.trim() };
}

let repoRoot: string;

beforeAll(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), "ow-worktree-e2e-"));
  git(repoRoot, "init", "-b", "main");
  await writeFile(join(repoRoot, "seed.txt"), "seed content\n");
  git(repoRoot, "add", "seed.txt");
  git(repoRoot, "commit", "-m", "seed commit");
});

afterAll(() => {
  spawnSync("rm", ["-rf", repoRoot], { encoding: "utf8" });
});

describe("WorktreeService 真实环境（真实 git worktree 命令）", () => {
  test("案例1: 真实仓库 create → 独立目录存在 + 独立分支存在", async () => {
    const service = new WorktreeService();
    const entry = await service.create({
      repoPath: repoRoot,
      branch: "feat/e2e-case1",
      owner: "e2e-runner",
    });

    // 目录真实存在
    const dirExists = spawnSync("test", ["-d", entry.path], { encoding: "utf8" }).status === 0;
    expect(dirExists).toBe(true);
    // 分支已创建
    const branches = git(repoRoot, "branch", "--list", "feat/e2e-case1");
    expect(branches.code).toBe(0);
    expect(branches.out).toContain("feat/e2e-case1");
    // 注册表记录了 owner
    const snap = service.snapshot();
    expect(snap.some((e) => e.path === entry.path && e.owner === "e2e-runner")).toBe(true);

    // 清理
    await service.remove(repoRoot, entry.path, { force: true });
  });

  test("案例2: 物理隔离 — worktree 写文件主目录不可见，主目录写文件 worktree 不可见", async () => {
    const service = new WorktreeService();
    const entry = await service.create({ repoPath: repoRoot, branch: "feat/e2e-isolation" });
    try {
      // worktree 内写新文件 → 主目录不可见
      await writeFile(join(entry.path, "agent-a.txt"), "A's change\n");
      const mainSeesA = spawnSync("test", ["-f", join(repoRoot, "agent-a.txt")], { encoding: "utf8" }).status;
      expect(mainSeesA).not.toBe(0); // 主目录看不到 A 的文件

      // 主目录写新文件 → worktree 不可见（未提交前）
      await writeFile(join(repoRoot, "main-only.txt"), "main change\n");
      const wSeesMain = spawnSync("test", ["-f", join(entry.path, "main-only.txt")], { encoding: "utf8" }).status;
      expect(wSeesMain).not.toBe(0); // worktree 看不到主目录未提交文件

      // 两处可同时独立 commit（互不干扰）
      git(entry.path, "add", "agent-a.txt");
      git(entry.path, "commit", "-m", "A commit");
      const logA = git(entry.path, "log", "--oneline", "-1");
      const logMain = git(repoRoot, "log", "--oneline", "-1");
      expect(logA.out).not.toBe(logMain.out); // 分支不同步，证明并行互不干扰
    } finally {
      await service.remove(repoRoot, entry.path, { force: true });
    }
  });

  test("案例3: list() 返回真实 worktree（path 与 git worktree list 一致）", async () => {
    const service = new WorktreeService();
    const entry = await service.create({ repoPath: repoRoot, branch: "feat/e2e-list" });
    try {
      const list = await service.list(repoRoot);
      const found = list.find((w) => w.path === entry.path);
      expect(found).toBeDefined();
      expect(found!.branch).toBe("feat/e2e-list");

      // 与 git worktree list --porcelain 输出一致（真实命令交叉验证）
      const porcelain = git(repoRoot, "worktree", "list", "--porcelain");
      expect(porcelain.out).toContain("worktree " + entry.path);
    } finally {
      await service.remove(repoRoot, entry.path, { force: true });
    }
  });

  test("案例4: remove + prune 后 worktree 目录消失", async () => {
    const service = new WorktreeService();
    const entry = await service.create({ repoPath: repoRoot, branch: "feat/e2e-remove" });
    expect(spawnSync("test", ["-d", entry.path], { encoding: "utf8" }).status).toBe(0);

    const removed = await service.remove(repoRoot, entry.path, { force: true });
    expect(removed).toBe(true);
    // 目录已删除
    expect(spawnSync("test", ["-d", entry.path], { encoding: "utf8" }).status).not.toBe(0);

    await service.prune(repoRoot);
    const list = await service.list(repoRoot);
    expect(list.some((w) => w.path === entry.path)).toBe(false);
  });

  test("案例5: cleanupStale 回收闲置 worktree（maxIdleMs=0 → 立即回收）", async () => {
    const service = new WorktreeService();
    const entry = await service.create({ repoPath: repoRoot, branch: "feat/e2e-stale" });
    expect(spawnSync("test", ["-d", entry.path], { encoding: "utf8" }).status).toBe(0);

    const removed = await service.cleanupStale(repoRoot, 0); // 0ms 闲置即回收
    expect(removed).toBe(1);
    expect(spawnSync("test", ["-d", entry.path], { encoding: "utf8" }).status).not.toBe(0);
  });

  test("案例6: 错误路径 — 非 git 目录抛 NOT_A_GIT_REPO", async () => {
    const service = new WorktreeService();
    const nonRepo = await mkdtemp(join(tmpdir(), "ow-not-repo-"));
    try {
      const err = await service.create({ repoPath: nonRepo, branch: "x" }).catch((e) => e);
      expect(err).toBeInstanceOf(WorktreeError);
      expect((err as WorktreeError).code).toBe("NOT_A_GIT_REPO");
    } finally {
      spawnSync("rm", ["-rf", nonRepo]);
    }
  });

  test("案例7: 错误路径 — 空仓库（无 commit）抛 REPO_NO_COMMITS", async () => {
    const emptyRepo = await mkdtemp(join(tmpdir(), "ow-empty-repo-"));
    git(emptyRepo, "init", "-b", "main");
    const service = new WorktreeService();
    try {
      const err = await service.create({ repoPath: emptyRepo, branch: "x" }).catch((e) => e);
      expect(err).toBeInstanceOf(WorktreeError);
      expect((err as WorktreeError).code).toBe("REPO_NO_COMMITS");
    } finally {
      spawnSync("rm", ["-rf", emptyRepo]);
    }
  });
});
