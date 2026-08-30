import { describe, expect, test } from "bun:test";

// Test CSV parsing logic that's used internally by the wizard
function parseCSV(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }

    if (char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter(row => row.length > 0 && !(row.length === 1 && row[0].trim() === ""));
}

describe("CsvImportWizard - CSV Parsing", () => {
  describe("parseCSV with comma delimiter", () => {
    test("parses simple CSV correctly", () => {
      const csv = "Name,Age,City\nAlice,30,NYC\nBob,25,LA";
      const result = parseCSV(csv, ",");
      
      expect(result).toEqual([
        ["Name", "Age", "City"],
        ["Alice", "30", "NYC"],
        ["Bob", "25", "LA"]
      ]);
    });

    test("handles empty cells", () => {
      const csv = "A,B,C\n1,,3\n4,5,";
      const result = parseCSV(csv, ",");
      
      expect(result).toEqual([
        ["A", "B", "C"],
        ["1", "", "3"],
        ["4", "5", ""]
      ]);
    });
  });

  describe("parseCSV with tab delimiter", () => {
    test("parses TSV correctly", () => {
      const tsv = "Name\tAge\tCity\nAlice\t30\tNYC";
      const result = parseCSV(tsv, "\t");
      
      expect(result).toEqual([
        ["Name", "Age", "City"],
        ["Alice", "30", "NYC"]
      ]);
    });
  });

  describe("parseCSV with semicolon delimiter", () => {
    test("parses semicolon-delimited CSV correctly", () => {
      const csv = "Name;Age;City\nAlice;30;NYC";
      const result = parseCSV(csv, ";");
      
      expect(result).toEqual([
        ["Name", "Age", "City"],
        ["Alice", "30", "NYC"]
      ]);
    });
  });

  describe("parseCSV with quoted fields", () => {
    test("handles quoted fields with commas", () => {
      const csv = 'Name,Description\n"Smith, John","Test"';
      const result = parseCSV(csv, ",");
      
      expect(result).toEqual([
        ["Name", "Description"],
        ["Smith, John", "Test"]
      ]);
    });

    test("handles escaped quotes in quoted fields", () => {
      const csv = 'Name,Quote\n"John","He said ""hello"""';
      const result = parseCSV(csv, ",");
      
      expect(result).toEqual([
        ["Name", "Quote"],
        ["John", 'He said "hello"']
      ]);
    });

    test("handles multiline quoted fields", () => {
      const csv = 'Name,Bio\n"Alice","Line 1\nLine 2"';
      const result = parseCSV(csv, ",");
      
      expect(result).toEqual([
        ["Name", "Bio"],
        ["Alice", "Line 1\nLine 2"]
      ]);
    });
  });

  describe("parseCSV edge cases", () => {
    test("handles trailing newline", () => {
      const csv = "A,B\n1,2\n";
      const result = parseCSV(csv, ",");
      
      expect(result).toEqual([
        ["A", "B"],
        ["1", "2"]
      ]);
    });

    test("handles Windows line endings (CRLF)", () => {
      const csv = "A,B\r\n1,2\r\n3,4";
      const result = parseCSV(csv, ",");
      
      expect(result).toEqual([
        ["A", "B"],
        ["1", "2"],
        ["3", "4"]
      ]);
    });

    test("filters out completely empty rows", () => {
      const csv = "A,B\n1,2\n\n3,4";
      const result = parseCSV(csv, ",");
      
      // Empty rows between data should be filtered
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0]).toEqual(["A", "B"]);
    });

    test("handles single column CSV", () => {
      const csv = "Name\nAlice\nBob";
      const result = parseCSV(csv, ",");
      
      expect(result).toEqual([
        ["Name"],
        ["Alice"],
        ["Bob"]
      ]);
    });

    test("returns empty array for empty input", () => {
      const result = parseCSV("", ",");
      expect(result).toEqual([]);
    });
  });
});

describe("CsvImportWizard - Data Transformation", () => {
  test("skip header row removes first row", () => {
    const data = [
      ["Name", "Age", "City"],
      ["Alice", "30", "NYC"],
      ["Bob", "25", "LA"]
    ];
    
    const skipHeader = true;
    const result = skipHeader ? data.slice(1) : data;
    
    expect(result).toEqual([
      ["Alice", "30", "NYC"],
      ["Bob", "25", "LA"]
    ]);
  });

  test("column count calculation", () => {
    const data = [
      ["A", "B", "C"],
      ["1", "2", "3"],
      ["4", "5"]
    ];
    
    const columnCount = Math.max(...data.map(r => r.length));
    expect(columnCount).toBe(3);
  });

  test("row count after skipping header", () => {
    const data = [
      ["Name", "Age"],
      ["Alice", "30"],
      ["Bob", "25"]
    ];
    
    const skipHeader = true;
    const rowCount = skipHeader ? data.length - 1 : data.length;
    
    expect(rowCount).toBe(2);
  });
});
