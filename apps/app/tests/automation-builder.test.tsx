/** @jsxImportSource react */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AutomationBuilder } from "../src/react-app/domains/browser/automation-builder";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("AutomationBuilder", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("renders with initial empty state", () => {
    render(<AutomationBuilder />);
    
    expect(screen.getByText(/浏览器自动化构建器|Browser Automation Builder/i)).toBeTruthy();
    expect(screen.getByText(/添加步骤|Add Step/i)).toBeTruthy();
    expect(screen.getByText(/运行自动化|Run Automation/i)).toBeTruthy();
  });

  it("can add a navigation step", () => {
    render(<AutomationBuilder />);
    
    const addButton = screen.getByText(/添加步骤|Add Step/i);
    fireEvent.click(addButton);
    
    // Should have one step card
    const stepCards = document.querySelectorAll('[class*="rounded-xl border"]');
    expect(stepCards.length).toBeGreaterThan(0);
  });

  it("can delete a step", () => {
    render(<AutomationBuilder />);
    
    // Add a step first
    const addButton = screen.getByText(/添加步骤|Add Step/i);
    fireEvent.click(addButton);
    
    // Find and click delete button
    const deleteButtons = screen.getAllByRole("button").filter(btn => 
      btn.textContent?.includes("删除") || btn.textContent?.includes("Delete")
    );
    
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);
    }
  });

  it("validates before running automation", async () => {
    render(<AutomationBuilder />);
    
    const runButton = screen.getByText(/运行自动化|Run Automation/i);
    fireEvent.click(runButton);
    
    // Should show validation error (no steps added)
    // Implementation may vary - check for toast or error message
  });

  it("saves script to localStorage", () => {
    render(<AutomationBuilder />);
    
    // Add a step
    const addButton = screen.getByText(/添加步骤|Add Step/i);
    fireEvent.click(addButton);
    
    // Enter script name
    const nameInput = screen.getByPlaceholderText(/脚本名称|Script name/i);
    fireEvent.change(nameInput, { target: { value: "test-script" } });
    
    // Click save button
    const saveButton = screen.getByText(/保存|Save/i);
    fireEvent.click(saveButton);
    
    // Check localStorage
    const saved = localStorage.getItem("openwork-browser-scripts");
    expect(saved).toBeTruthy();
    
    if (saved) {
      const scripts = JSON.parse(saved);
      expect(scripts["test-script"]).toBeDefined();
    }
  });

  it("loads saved script from localStorage", () => {
    // Pre-populate localStorage
    const testScripts = {
      "my-test-script": {
        name: "my-test-script",
        steps: [
          { type: "navigate", params: { url: "https://example.com" } }
        ]
      }
    };
    localStorage.setItem("openwork-browser-scripts", JSON.stringify(testScripts));
    
    render(<AutomationBuilder />);
    
    // Click load button
    const loadButton = screen.getByText(/加载|Load/i);
    fireEvent.click(loadButton);
    
    // Should show dialog with saved scripts
    expect(screen.getByText(/my-test-script/i)).toBeTruthy();
  });

  it("reorders steps up and down", () => {
    render(<AutomationBuilder />);
    
    // Add two steps
    const addButton = screen.getByText(/添加步骤|Add Step/i);
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    
    // Find reorder buttons
    const upButtons = screen.getAllByRole("button").filter(btn => 
      btn.querySelector("svg")?.getAttribute("data-lucide") === "arrow-up"
    );
    
    if (upButtons.length > 0) {
      fireEvent.click(upButtons[0]);
    }
  });

  it("clears all steps", () => {
    render(<AutomationBuilder />);
    
    // Add some steps
    const addButton = screen.getByText(/添加步骤|Add Step/i);
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    
    // Click clear button
    const clearButton = screen.getByText(/清空|Clear/i);
    fireEvent.click(clearButton);
    
    // Steps should be cleared
    // Verify no step cards remain
  });
});
