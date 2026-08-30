import { describe, expect, test } from "bun:test";

import {
  evaluateFormula,
  parseCellReference,
  getRangeCells,
  hasCircularReference,
} from "../src/react-app/domains/spreadsheet/formula-engine";

describe("parseCellReference", () => {
  test("parses simple cell references", () => {
    expect(parseCellReference("A1")).toEqual({ col: 0, row: 1 });
    expect(parseCellReference("B2")).toEqual({ col: 1, row: 2 });
    expect(parseCellReference("C3")).toEqual({ col: 2, row: 3 });
  });

  test("parses multi-letter column references", () => {
    expect(parseCellReference("AA1")).toEqual({ col: 26, row: 1 });
    expect(parseCellReference("AB2")).toEqual({ col: 27, row: 2 });
    expect(parseCellReference("ZZ10")).toEqual({ col: 701, row: 10 });
  });

  test("handles case insensitivity", () => {
    expect(parseCellReference("a1")).toEqual({ col: 0, row: 1 });
    expect(parseCellReference("Bc3")).toEqual({ col: 54, row: 3 });
  });

  test("throws error for invalid references", () => {
    expect(() => parseCellReference("1A")).toThrow("Invalid cell reference");
    expect(() => parseCellReference("A")).toThrow("Invalid cell reference");
    expect(() => parseCellReference("")).toThrow("Invalid cell reference");
  });
});

describe("getRangeCells", () => {
  test("expands vertical range", () => {
    const cells = getRangeCells("A1", "A5");
    expect(cells).toEqual(["A1", "A2", "A3", "A4", "A5"]);
  });

  test("expands horizontal range", () => {
    const cells = getRangeCells("A1", "C1");
    expect(cells).toEqual(["A1", "B1", "C1"]);
  });

  test("expands rectangular range", () => {
    const cells = getRangeCells("A1", "B2");
    expect(cells).toEqual(["A1", "A2", "B1", "B2"]);
  });

  test("handles single cell range", () => {
    const cells = getRangeCells("A1", "A1");
    expect(cells).toEqual(["A1"]);
  });

  test("handles multi-letter columns in ranges", () => {
    const cells = getRangeCells("AA1", "AC2");
    expect(cells).toEqual(["AA1", "AA2", "AB1", "AB2", "AC1", "AC2"]);
  });
});

describe("evaluateFormula - basic values", () => {
  test("returns plain text as-is", () => {
    expect(evaluateFormula("hello", {})).toBe("hello");
  });

  test("converts numeric strings to numbers", () => {
    expect(evaluateFormula("123", {})).toBe(123);
    expect(evaluateFormula("45.67", {})).toBe(45.67);
  });

  test("handles empty string", () => {
    expect(evaluateFormula("", {})).toBe(0);
  });
});

describe("evaluateFormula - SUM function", () => {
  test("sums a range of cells", () => {
    const cellData = {
      A1: "10",
      A2: "20",
      A3: "30",
      A4: "40",
      A5: "50",
    };
    expect(evaluateFormula("=SUM(A1:A5)", cellData)).toBe(150);
  });

  test("sums individual cells", () => {
    const cellData = {
      A1: "5",
      B1: "10",
      C1: "15",
    };
    expect(evaluateFormula("=SUM(A1,B1,C1)", cellData)).toBe(30);
  });

  test("sums mixed ranges and cells", () => {
    const cellData = {
      A1: "1",
      A2: "2",
      A3: "3",
      B1: "10",
    };
    expect(evaluateFormula("=SUM(A1:A3,B1)", cellData)).toBe(16);
  });

  test("handles empty cells as zero", () => {
    const cellData = {
      A1: "10",
      A3: "20",
    };
    expect(evaluateFormula("=SUM(A1:A3)", cellData)).toBe(30);
  });

  test("sums single cell", () => {
    const cellData = { A1: "42" };
    expect(evaluateFormula("=SUM(A1)", cellData)).toBe(42);
  });
});

describe("evaluateFormula - AVG function", () => {
  test("calculates average of range", () => {
    const cellData = {
      B1: "10",
      B2: "20",
      B3: "30",
      B4: "40",
      B5: "50",
      B6: "60",
      B7: "70",
      B8: "80",
      B9: "90",
      B10: "100",
    };
    expect(evaluateFormula("=AVG(B1:B10)", cellData)).toBe(55);
  });

  test("calculates average with AVERAGE alias", () => {
    const cellData = {
      A1: "10",
      A2: "20",
      A3: "30",
    };
    expect(evaluateFormula("=AVERAGE(A1:A3)", cellData)).toBe(20);
  });

  test("returns 0 for empty range", () => {
    const cellData = {};
    expect(evaluateFormula("=AVG(A1:A5)", cellData)).toBe(0);
  });
});

describe("evaluateFormula - MIN function", () => {
  test("finds minimum in range", () => {
    const cellData = {
      A1: "50",
      A2: "20",
      A3: "80",
      A4: "10",
      A5: "60",
    };
    expect(evaluateFormula("=MIN(A1:A5)", cellData)).toBe(10);
  });

  test("finds minimum in mixed cells", () => {
    const cellData = {
      A1: "100",
      B1: "50",
      C1: "75",
    };
    expect(evaluateFormula("=MIN(A1,B1,C1)", cellData)).toBe(50);
  });
});

describe("evaluateFormula - MAX function", () => {
  test("finds maximum in range", () => {
    const cellData = {
      A1: "50",
      A2: "20",
      A3: "80",
      A4: "10",
      A5: "60",
    };
    expect(evaluateFormula("=MAX(A1:A5)", cellData)).toBe(80);
  });

  test("finds maximum in mixed cells", () => {
    const cellData = {
      A1: "100",
      B1: "50",
      C1: "75",
    };
    expect(evaluateFormula("=MAX(A1,B1,C1)", cellData)).toBe(100);
  });
});

describe("evaluateFormula - COUNT function", () => {
  test("counts cells in range", () => {
    const cellData = {
      A1: "10",
      A2: "20",
      A3: "",
      A4: "40",
      A5: "50",
    };
    expect(evaluateFormula("=COUNT(A1:A5)", cellData)).toBe(5);
  });

  test("counts individual cells", () => {
    const cellData = {
      A1: "5",
      B1: "10",
      C1: "15",
    };
    expect(evaluateFormula("=COUNT(A1,B1,C1)", cellData)).toBe(3);
  });
});

describe("evaluateFormula - arithmetic expressions", () => {
  test("adds two cells", () => {
    const cellData = {
      A1: "10",
      B2: "20",
    };
    expect(evaluateFormula("=A1+B2", cellData)).toBe(30);
  });

  test("subtracts cells", () => {
    const cellData = {
      A1: "50",
      B1: "20",
    };
    expect(evaluateFormula("=A1-B1", cellData)).toBe(30);
  });

  test("multiplies cells", () => {
    const cellData = {
      A1: "5",
      B1: "6",
    };
    expect(evaluateFormula("=A1*B1", cellData)).toBe(30);
  });

  test("divides cells", () => {
    const cellData = {
      A1: "100",
      B1: "4",
    };
    expect(evaluateFormula("=A1/B1", cellData)).toBe(25);
  });

  test("respects operator precedence", () => {
    const cellData = {
      A1: "10",
      B1: "5",
      C1: "2",
    };
    expect(evaluateFormula("=A1+B1*C1", cellData)).toBe(20);
  });

  test("handles parentheses", () => {
    const cellData = {
      A1: "10",
      B1: "5",
      C1: "2",
    };
    expect(evaluateFormula("=(A1+B1)*C1", cellData)).toBe(30);
  });

  test("complex expression", () => {
    const cellData = {
      A1: "100",
      B1: "50",
      C1: "25",
    };
    expect(evaluateFormula("=(A1-B1)/C1", cellData)).toBe(2);
  });

  test("handles decimal numbers", () => {
    const cellData = {
      A1: "10.5",
      B1: "20.3",
    };
    expect(evaluateFormula("=A1+B1", cellData)).toBeCloseTo(30.8, 5);
  });
});

describe("evaluateFormula - circular reference detection", () => {
  test("detects direct circular reference", () => {
    const cellData = {
      A1: "=A1+1",
    };
    expect(evaluateFormula("=A1", cellData)).toBe("#CIRCULAR!");
  });

  test("detects indirect circular reference", () => {
    const cellData = {
      A1: "=B1+1",
      B1: "=A1+1",
    };
    expect(evaluateFormula("=A1", cellData)).toBe("#CIRCULAR!");
  });

  test("hasCircularReference detects self-reference", () => {
    expect(hasCircularReference("=A1+1", "A1")).toBe(true);
  });

  test("hasCircularReference allows non-circular references", () => {
    expect(hasCircularReference("=B1+1", "A1")).toBe(false);
    expect(hasCircularReference("=A2+B2", "A1")).toBe(false);
  });
});

describe("evaluateFormula - error handling", () => {
  test("returns error for unknown functions", () => {
    const cellData = { A1: "10" };
    expect(evaluateFormula("=UNKNOWN(A1)", cellData)).toBe("#ERROR!");
  });

  test("handles missing cell references as zero", () => {
    const cellData = {};
    expect(evaluateFormula("=A1+B1", cellData)).toBe(0);
  });

  test("handles non-numeric cell values as zero", () => {
    const cellData = {
      A1: "text",
      B1: "10",
    };
    expect(evaluateFormula("=A1+B1", cellData)).toBe(10);
  });

  test("handles division by zero gracefully", () => {
    const cellData = {
      A1: "10",
      B1: "0",
    };
    const result = evaluateFormula("=A1/B1", cellData);
    expect(result).toBe(Infinity);
  });
});

describe("evaluateFormula - nested formulas", () => {
  test("evaluates formula referencing another formula", () => {
    const cellData = {
      A1: "10",
      A2: "20",
      A3: "=SUM(A1:A2)",
      B1: "=A3*2",
    };
    expect(evaluateFormula("=B1", cellData)).toBe(60);
  });

  test("evaluates nested SUM", () => {
    const cellData = {
      A1: "5",
      A2: "10",
      B1: "15",
      B2: "20",
    };
    // This would be an advanced feature - just testing basic behavior
    expect(evaluateFormula("=SUM(A1:A2)", cellData)).toBe(15);
  });
});

describe("evaluateFormula - edge cases", () => {
  test("handles whitespace in formulas", () => {
    const cellData = {
      A1: "10",
      B1: "20",
    };
    expect(evaluateFormula("= A1 + B1", cellData)).toBe(30);
    expect(evaluateFormula("=SUM( A1 : B1 )", cellData)).toBe(30);
  });

  test("handles large numbers", () => {
    const cellData = {
      A1: "1000000",
      B1: "2000000",
    };
    expect(evaluateFormula("=A1+B1", cellData)).toBe(3000000);
  });

  test("handles negative numbers", () => {
    const cellData = {
      A1: "-10",
      B1: "5",
    };
    expect(evaluateFormula("=A1+B1", cellData)).toBe(-5);
  });

  test("case insensitive function names", () => {
    const cellData = {
      A1: "10",
      A2: "20",
    };
    expect(evaluateFormula("=sum(A1:A2)", cellData)).toBe(30);
    expect(evaluateFormula("=Sum(A1:A2)", cellData)).toBe(30);
    expect(evaluateFormula("=SUM(A1:A2)", cellData)).toBe(30);
  });
});
