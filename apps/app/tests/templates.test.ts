import { describe, expect, test } from "bun:test";
import { getTemplate, listTemplates, generateFiles } from "../src/react-app/domains/codegen/templates";

describe("templates library", () => {
  test("listTemplates returns exactly 5 templates", () => {
    const templates = listTemplates();
    expect(templates).toHaveLength(5);
  });

  test("each template has required fields", () => {
    const templates = listTemplates();
    
    for (const template of templates) {
      expect(template).toHaveProperty("id");
      expect(template).toHaveProperty("name");
      expect(template).toHaveProperty("description");
      expect(template).toHaveProperty("techStack");
      expect(template).toHaveProperty("icon");
      
      // Verify techStack is an array
      expect(Array.isArray(template.techStack)).toBe(true);
      expect(template.techStack.length).toBeGreaterThan(0);
    }
  });

  test("getTemplate('react-vite') returns correct React template", () => {
    const template = getTemplate("react-vite");
    
    expect(template).toBeDefined();
    expect(template?.id).toBe("react-vite");
    expect(template?.name).toBe("React + TypeScript + Vite");
    expect(template?.techStack).toContain("React");
    expect(template?.techStack).toContain("TypeScript");
    expect(template?.techStack).toContain("Vite");
    expect(template?.dependencies).toContain("react");
    expect(template?.dependencies).toContain("react-dom");
  });

  test("getTemplate('nonexistent') returns undefined", () => {
    const template = getTemplate("nonexistent-template");
    expect(template).toBeUndefined();
  });

  test("generateFiles returns files with valid paths and non-empty content", () => {
    const files = generateFiles("react-vite");
    
    expect(files.length).toBeGreaterThan(0);
    
    for (const file of files) {
      expect(file).toHaveProperty("path");
      expect(file).toHaveProperty("content");
      expect(typeof file.path).toBe("string");
      expect(typeof file.content).toBe("string");
      expect(file.path.length).toBeGreaterThan(0);
      expect(file.content.length).toBeGreaterThan(0);
    }
  });

  test("all templates have at least package.json or requirements.txt file", () => {
    const templateIds = ["react-vite", "node-express", "python-fastapi", "nextjs-app-router", "vue-vite"];
    
    for (const templateId of templateIds) {
      const files = generateFiles(templateId);
      const hasPackageFile = files.some((f) => f.path === "package.json");
      const hasRequirementsFile = files.some((f) => f.path === "requirements.txt");
      
      expect(hasPackageFile || hasRequirementsFile).toBe(true);
    }
  });

  test("template IDs are unique", () => {
    const templates = listTemplates();
    const ids = templates.map((t) => t.id);
    const uniqueIds = new Set(ids);
    
    expect(uniqueIds.size).toBe(ids.length);
  });

  test("file paths don't start with / (should be relative)", () => {
    const templateIds = ["react-vite", "node-express", "python-fastapi", "nextjs-app-router", "vue-vite"];
    
    for (const templateId of templateIds) {
      const files = generateFiles(templateId);
      
      for (const file of files) {
        expect(file.path.startsWith("/")).toBe(false);
        expect(file.path).not.toMatch(/^\//);
      }
    }
  });

  test("generateFiles throws error for non-existent template", () => {
    expect(() => generateFiles("nonexistent")).toThrow('Template "nonexistent" not found');
  });

  test("Node.js Express template has essential files", () => {
    const files = generateFiles("node-express");
    const paths = files.map((f) => f.path);
    
    expect(paths).toContain("package.json");
    expect(paths).toContain("tsconfig.json");
    expect(paths).toContain("src/index.ts");
    expect(paths).toContain("src/routes/index.ts");
  });

  test("Python FastAPI template has essential files", () => {
    const files = generateFiles("python-fastapi");
    const paths = files.map((f) => f.path);
    
    expect(paths).toContain("requirements.txt");
    expect(paths).toContain("main.py");
    expect(paths).toContain("api/routes.py");
  });

  test("Next.js template has App Router structure", () => {
    const files = generateFiles("nextjs-app-router");
    const paths = files.map((f) => f.path);
    
    expect(paths).toContain("package.json");
    expect(paths).toContain("next.config.js");
    expect(paths).toContain("src/app/page.tsx");
    expect(paths).toContain("src/app/layout.tsx");
  });

  test("Vue template has composition API structure", () => {
    const files = generateFiles("vue-vite");
    const paths = files.map((f) => f.path);
    
    expect(paths).toContain("package.json");
    expect(paths).toContain("src/main.ts");
    expect(paths).toContain("src/App.vue");
    expect(paths).toContain("src/stores/counter.ts");
  });

  test("each template has dependencies defined", () => {
    const templates = listTemplates();
    
    for (const template of templates) {
      const fullTemplate = getTemplate(template.id);
      expect(fullTemplate?.dependencies).toBeDefined();
      expect(Array.isArray(fullTemplate?.dependencies)).toBe(true);
      expect(fullTemplate?.dependencies.length).toBeGreaterThan(0);
    }
  });

  test("template descriptions are informative", () => {
    const templates = listTemplates();
    
    for (const template of templates) {
      expect(template.description.length).toBeGreaterThan(10);
      expect(template.description.length).toBeLessThan(200);
    }
  });
});
