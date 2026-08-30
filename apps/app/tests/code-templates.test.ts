import { describe, test, expect } from "bun:test";
import { CODE_TEMPLATES, getTemplateById, listTemplates } from "../src/react-app/domains/templates/code-templates";

describe("Code Templates", () => {
  test("exports predefined templates", () => {
    expect(CODE_TEMPLATES.length).toBeGreaterThan(0);
    expect(CODE_TEMPLATES[0].id).toBe("react-vite");
  });

  test("React Vite template has required files", () => {
    const template = getTemplateById("react-vite");
    expect(template).toBeDefined();
    expect(template?.files.length).toBeGreaterThan(0);
    
    const paths = template?.files.map((f) => f.path) || [];
    expect(paths).toContain("package.json");
    expect(paths).toContain("tsconfig.json");
    expect(paths).toContain("vite.config.ts");
    expect(paths).toContain("src/App.tsx");
  });

  test("Node Express template has server file", () => {
    const template = getTemplateById("node-express");
    expect(template).toBeDefined();
    
    const paths = template?.files.map((f) => f.path) || [];
    expect(paths).toContain("src/server.ts");
  });

  test("Python FastAPI template has main file", () => {
    const template = getTemplateById("python-fastapi");
    expect(template).toBeDefined();
    
    const paths = template?.files.map((f) => f.path) || [];
    expect(paths).toContain("main.py");
  });

  test("getTemplateById returns undefined for invalid ID", () => {
    const template = getTemplateById("nonexistent");
    expect(template).toBeUndefined();
  });

  test("listTemplates returns summary info only", () => {
    const summaries = listTemplates();
    expect(summaries.length).toBe(CODE_TEMPLATES.length);
    
    summaries.forEach((summary) => {
      expect(summary).toHaveProperty("id");
      expect(summary).toHaveProperty("name");
      expect(summary).toHaveProperty("description");
      expect(summary).toHaveProperty("language");
      expect(summary).not.toHaveProperty("files");
    });
  });

  test("each template has valid structure", () => {
    CODE_TEMPLATES.forEach((template) => {
      expect(template.id).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.language).toBeTruthy();
      expect(Array.isArray(template.files)).toBe(true);
      
      template.files.forEach((file) => {
        expect(file.path).toBeTruthy();
        expect(file.content).toBeTruthy();
      });
    });
  });
});
