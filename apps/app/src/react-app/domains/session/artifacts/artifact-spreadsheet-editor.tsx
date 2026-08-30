/** @jsxImportSource react */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseSpreadsheet, serializeSpreadsheet, type SpreadsheetRows } from "./artifact-spreadsheet-model";
import { cn } from "@/lib/utils";
import type { Data } from "./open-target";
import { evaluateFormula } from "../../spreadsheet/formula-engine";
import { CsvImportWizard } from "../../spreadsheet/csv-import-wizard";

type ArtifactSpreadsheetEditorProps = {
  className?: string;
  name: string;
  content: Data;
  saving?: boolean;
  onSave: (payload: Data) => void | Promise<void>;
};

function cloneRows(rows: SpreadsheetRows): SpreadsheetRows {
  return rows.map((row) => [...row]);
}

function normalizeShape(rows: SpreadsheetRows): SpreadsheetRows {
  const width = Math.max(1, ...rows.map((row) => row.length));

  return rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
}

interface UseSpreadsheetProps {
  name: string;
  content: Data;
  onSave: (payload: Data) => void | Promise<void>;
}

function useSpreadsheet({ name, content, onSave }: UseSpreadsheetProps) {
  const { data, error, isLoading } = useQuery({
    queryKey: ["artifact-spreadsheet", name, content] as const,
    queryFn: async () => normalizeShape(await parseSpreadsheet({ name, content })),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const [rows, setRows] = useState<SpreadsheetRows>([[""]]);
  const [baseRows, setBaseRows] = useState<SpreadsheetRows>([[""]]);
  const isDirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(baseRows), [baseRows, rows]);

  useEffect(() => {
    if (!data) {
      return;
    }

    setRows(data);
    setBaseRows(cloneRows(data));
  }, [data]);

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const serialized = await serializeSpreadsheet(name, rows);

      await onSave(serialized);
    },
    onSuccess: () => {
      setBaseRows(cloneRows(rows));
    },
  });

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    setRows((current) => {
      const next = cloneRows(current);

      next[rowIndex] = [...(next[rowIndex] ?? [])];
      next[rowIndex][columnIndex] = value;

      return normalizeShape(next);
    });
  };

  const appendRows = (newRows: SpreadsheetRows) => {
    setRows((current) => {
      const currentWidth = Math.max(1, ...current.map((row) => row.length));
      const newWidth = Math.max(currentWidth, ...newRows.map((row) => row.length));
      
      // Normalize existing rows
      const normalizedCurrent = current.map((row) =>
        Array.from({ length: newWidth }, (_, i) => row[i] ?? "")
      );
      
      // Normalize new rows
      const normalizedNew = newRows.map((row) =>
        Array.from({ length: newWidth }, (_, i) => row[i] ?? "")
      );
      
      return [...normalizedCurrent, ...normalizedNew];
    });
  };

  const addRow = () => setRows((current) => [...current, Array.from({ length: Math.max(1, current[0]?.length ?? 1) }, () => "")]);
  const addColumn = () => setRows((current) => current.map((row) => [...row, ""]));
  const discard = () => setRows(cloneRows(baseRows));

  return { rows, error, isLoading, updateCell, appendRows, addRow, addColumn, discard, isDirty, save, isSaving };
}

function getCellReference(rowIndex: number, columnIndex: number): string {
  let colLetter = "";
  let n = columnIndex;
  
  do {
    colLetter = String.fromCharCode(65 + (n % 26)) + colLetter;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  
  return `${colLetter}${rowIndex + 1}`;
}

export function ArtifactSpreadsheetEditor(props: ArtifactSpreadsheetEditorProps) {
  const { rows, error, isLoading, updateCell, appendRows, addRow, addColumn, discard, isDirty, save, isSaving } = useSpreadsheet(props);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [formulaBarValue, setFormulaBarValue] = useState("");
  const [showCsvImportWizard, setShowCsvImportWizard] = useState(false);
  const saving = props.saving || isSaving;

  const handleImportCsv = (importedRows: string[][]) => {
    // Append imported rows to current spreadsheet
    if (importedRows.length === 0) return;
    appendRows(importedRows);
  };

  const handleCellSelect = (rowIndex: number, columnIndex: number) => {
    setSelectedCell({ row: rowIndex, col: columnIndex });
    const cellValue = rows[rowIndex]?.[columnIndex] ?? "";
    setFormulaBarValue(cellValue);
  };

  const handleFormulaBarChange = (value: string) => {
    setFormulaBarValue(value);
    if (selectedCell) {
      updateCell(selectedCell.row, selectedCell.col, value);
    }
  };

  const getDisplayValue = (rowIndex: number, columnIndex: number): string => {
    const rawValue = rows[rowIndex]?.[columnIndex] ?? "";
    
    if (rawValue.startsWith("=")) {
      const cellData: Record<string, string> = {};
      rows.forEach((row, rIdx) => {
        row.forEach((cell, cIdx) => {
          const ref = getCellReference(rIdx, cIdx);
          cellData[ref] = cell;
        });
      });
      
      const result = evaluateFormula(rawValue, cellData);
      return String(result);
    }
    
    return rawValue;
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "Failed to parse spreadsheet"}
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", props.className)}>
      <div className="flex shrink-0 items-center gap-2 px-3 py-2 border-b border-border">
        <Button variant="ghost" size="xs" onClick={addRow}><Plus className="size-3" /> Row</Button>
        <Button variant="ghost" size="xs" onClick={addColumn}><Plus className="size-3" /> Column</Button>
        <Button 
          variant="ghost" 
          size="xs" 
          onClick={() => setShowCsvImportWizard(true)}
          title="Import CSV"
        >
          <Upload className="size-3" /> Import CSV
        </Button>
        <div className="min-w-0 flex-1" />
        <Button variant="ghost" size="xs" onClick={discard} disabled={!isDirty || saving}>Discard</Button>
        <Button variant="default" size="xs" onClick={() => save()} disabled={!isDirty || saving}>{saving ? "Saving" : "Save"}</Button>
      </div>
      
      {/* Formula Bar */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground w-16">
          {selectedCell ? getCellReference(selectedCell.row, selectedCell.col) : ""}
        </span>
        <Input
          className="h-8 flex-1 text-xs"
          placeholder="Enter value or formula (e.g., =SUM(A1:A5))"
          value={formulaBarValue}
          onChange={(e) => handleFormulaBarChange(e.target.value)}
          onFocus={() => {
            if (selectedCell) {
              const rawValue = rows[selectedCell.row]?.[selectedCell.col] ?? "";
              setFormulaBarValue(rawValue);
            }
          }}
          onBlur={() => {
            if (selectedCell) {
              const displayValue = getDisplayValue(selectedCell.row, selectedCell.col);
              setFormulaBarValue(displayValue);
            }
          }}
        />
      </div>
      
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, columnIndex) => {
                  const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === columnIndex;
                  const displayValue = getDisplayValue(rowIndex, columnIndex);
                  
                  return (
                    <td 
                      key={columnIndex} 
                      className={cn(
                        "border-b not-first:border-l border-border p-0 align-top cursor-cell",
                        isSelected && "bg-muted/50 ring-2 ring-inset ring-primary"
                      )}
                      onClick={() => handleCellSelect(rowIndex, columnIndex)}
                    >
                      <input
                        className="h-8 w-full min-w-[120px] bg-transparent px-2 text-foreground outline-none focus:bg-muted/50"
                        value={displayValue}
                        onChange={(event) => {
                          updateCell(rowIndex, columnIndex, event.target.value);
                          setFormulaBarValue(event.target.value);
                        }}
                        onFocus={() => handleCellSelect(rowIndex, columnIndex)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* CSV Import Wizard Dialog */}
      {showCsvImportWizard && (
        <CsvImportWizard
          onImport={handleImportCsv}
          onCancel={() => setShowCsvImportWizard(false)}
        />
      )}
    </div>
  );
}
