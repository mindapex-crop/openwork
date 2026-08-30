import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exists } from "./utils.js";
import {
  BUILTIN_OFFICE_SKILLS,
  ensureBuiltinOfficeSkills,
  openclawExport,
  openclawExportToDir,
  openclawImport,
} from "./skills.js";

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), "openwork-openclaw-"));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe("openclawImport", () => {
  test("imports an OpenClaw-layout skill directory with assets", async () => {
    const skillDir = join(workspace, "web-research");
    await mkdir(join(skillDir, "scripts"), { recursive: true });
    await mkdir(join(skillDir, "reference"), { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      "---\nname: web-research\ndescription: Research the web and summarize findings.\n---\n\n# Skill: web-research\n\nSearch and synthesize.\n",
      "utf8",
    );
    await writeFile(join(skillDir, "scripts", "run.py"), "print('hello')\n", "utf8");
    await writeFile(join(skillDir, "reference", "guide.md"), "# Guide\n\nSteps.\n", "utf8");
    await writeFile(join(skillDir, "requirements.txt"), "requests>=2.0\n", "utf8");

    const bundle = await openclawImport(skillDir);
    expect(bundle.name).toBe("web-research");
    expect(bundle.description).toBe("Research the web and summarize findings.");
    expect(bundle.body).toContain("# Skill: web-research");
    const filePaths = bundle.files.map((file) => file.path);
    expect(filePaths).toContain("SKILL.md");
    expect(filePaths).toContain("scripts/run.py");
    expect(filePaths).toContain("reference/guide.md");
    expect(filePaths).toContain("requirements.txt");
    const skillMd = bundle.files.find((file) => file.path === "SKILL.md");
    expect(skillMd?.content).toContain("name: web-research");
  });

  test("falls back to the directory name when frontmatter name is absent", async () => {
    const skillDir = join(workspace, "my-skill");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      "---\ndescription: No name here.\n---\n\nBody text.\n",
      "utf8",
    );
    const bundle = await openclawImport(skillDir);
    expect(bundle.name).toBe("my-skill");
  });

  test("throws when SKILL.md is missing", async () => {
    const skillDir = join(workspace, "empty-skill");
    await mkdir(skillDir, { recursive: true });
    await expect(openclawImport(skillDir)).rejects.toThrow("SKILL.md not found");
  });

  test("ignores .git and oversized assets", async () => {
    const skillDir = join(workspace, "big-skill");
    await mkdir(join(skillDir, ".git"), { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), "---\nname: big-skill\ndescription: Big.\n---\n\nBody.\n", "utf8");
    await writeFile(join(skillDir, ".git", "HEAD"), "ref: refs/heads/main\n", "utf8");
    await writeFile(join(skillDir, "huge.bin"), Buffer.alloc(600 * 1024, 0x61), "utf8");

    const bundle = await openclawImport(skillDir);
    const paths = bundle.files.map((file) => file.path);
    expect(paths).not.toContain(".git/HEAD");
    expect(paths).not.toContain("huge.bin");
  });
});

describe("openclawExport", () => {
  test("exports an own-format skill to the OpenClaw SKILL.md layout", () => {
    const bundle = openclawExport({
      name: "office-doc",
      description: "将对话结论生成为 Word 文档交付物",
      trigger: "导出为 Word 文档",
      content: "---\nname: office-doc\ndescription: old\n---\n\n# Skill: office-doc\n\nBody.\n",
      extraFiles: [{ path: "scripts\\gen.mjs", content: "export {};\n" }],
    });
    expect(bundle.name).toBe("office-doc");
    expect(bundle.description).toBe("将对话结论生成为 Word 文档交付物");
    expect(bundle.trigger).toBe("导出为 Word 文档");
    const skillMd = bundle.files[0];
    expect(skillMd?.path).toBe("SKILL.md");
    expect(skillMd?.content).toStartWith("---\n");
    expect(skillMd?.content).toContain("name: office-doc");
    expect(skillMd?.content).toContain("description: 将对话结论生成为 Word 文档交付物");
    expect(skillMd?.content).toContain("trigger: 导出为 Word 文档");
    expect(bundle.files.map((file) => file.path)).toContain("scripts/gen.mjs");
  });

  test("round-trips an imported bundle through export and back to disk", async () => {
    const sourceDir = join(workspace, "src-skill");
    await mkdir(join(sourceDir, "scripts"), { recursive: true });
    await writeFile(join(sourceDir, "SKILL.md"), "---\nname: src-skill\ndescription: Round trip.\n---\n\nBody here.\n", "utf8");
    await writeFile(join(sourceDir, "scripts", "run.sh"), "#!/bin/sh\necho hi\n", "utf8");

    const imported = await openclawImport(sourceDir);
    const exported = openclawExport({
      name: imported.name,
      content: imported.files.find((file) => file.path === "SKILL.md")?.content ?? "",
      extraFiles: imported.files.filter((file) => file.path !== "SKILL.md"),
    });

    const targetDir = join(workspace, "exported-skill");
    const written = await openclawExportToDir(exported, targetDir);
    expect(written.length).toBe(2);
    expect(await readFile(join(targetDir, "SKILL.md"), "utf8")).toContain("Body here.");
    expect(await readFile(join(targetDir, "scripts", "run.sh"), "utf8")).toBe("#!/bin/sh\necho hi\n");
    expect(await exists(join(targetDir, "SKILL.md"))).toBe(true);
  });
});

describe("built-in office skills", () => {
  test("registers the four office delivery skills", () => {
    const names = BUILTIN_OFFICE_SKILLS.map((skill) => skill.name);
    expect(names).toEqual(["office-doc", "office-slide", "office-sheet", "office-pdf"]);
    for (const skill of BUILTIN_OFFICE_SKILLS) {
      expect(skill.content).toContain(`name: ${skill.name}`);
      expect(skill.content).toContain("对话到交付");
    }
  });

  test("ensureBuiltinOfficeSkills materializes SKILL.md files idempotently", async () => {
    const first = await ensureBuiltinOfficeSkills(workspace);
    expect(first.every((result) => result.action === "added")).toBe(true);
    const second = await ensureBuiltinOfficeSkills(workspace);
    expect(second.every((result) => result.action === "unchanged")).toBe(true);

    const docPath = join(workspace, ".opencode", "skills", "office-doc", "SKILL.md");
    expect(await exists(docPath)).toBe(true);
    expect(await readFile(docPath, "utf8")).toBe(
      BUILTIN_OFFICE_SKILLS.find((skill) => skill.name === "office-doc")?.content ?? "",
    );
  });
});
