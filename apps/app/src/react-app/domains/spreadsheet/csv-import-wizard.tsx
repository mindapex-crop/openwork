/** @jsxImportSource react */
import { useState, useMemo } from "react";
import { FileText, ArrowRight, ArrowLeft, Check, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { t } from "@/i18n";

interface CsvImportWizardProps {
  onImport: (rows: string[][]) => void;
  onCancel: () => void;
}

type WizardStep = 1 | 2 | 3 | 4;

interface ParsedData {
  fileName: string;
  rawContent: string;
  rows: string[][];
}

const DELIMITERS = [
  { value: ",", label: "Comma (,)" },
  { value: "\t", label: "Tab" },
  { value: ";", label: "Semicolon (;)" },
];

export function CsvImportWizard({ onImport, onCancel }: CsvImportWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [delimiter, setDelimiter] = useState(",");
  const [skipHeaderRow, setSkipHeaderRow] = useState(false);
  const [columnMappings, setColumnMappings] = useState<Record<number, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const readFileContent = async (): Promise<string> => {
    if (!file) return "";
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file, "UTF-8");
    });
  };

  const parseCSV = (content: string, delim: string): string[][] => {
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

      if (char === delim) {
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
  };

  const handleNext = async () => {
    if (step === 1 && file) {
      try {
        setIsProcessing(true);
        const content = await readFileContent();
        const rows = parseCSV(content, delimiter);
        
        setParsedData({
          fileName: file.name,
          rawContent: content,
          rows,
        });

        // Initialize column mappings (identity mapping)
        const maxCols = Math.max(...rows.map(r => r.length));
        const mappings: Record<number, number> = {};
        for (let i = 0; i < maxCols; i++) {
          mappings[i] = i;
        }
        setColumnMappings(mappings);
        
        setStep(2);
      } catch (error) {
        console.error("Failed to read file:", error);
      } finally {
        setIsProcessing(false);
      }
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as WizardStep);
    }
  };

  const handleImport = () => {
    if (!parsedData) return;

    let dataRows = parsedData.rows;
    
    // Apply skip header row
    if (skipHeaderRow) {
      dataRows = dataRows.slice(1);
    }

    // Apply column mappings (reorder columns based on mapping)
    const mappedRows = dataRows.map(row => {
      const mappedRow: string[] = [];
      const sortedKeys = Object.keys(columnMappings).map(Number).sort((a, b) => a - b);
      
      for (const srcIndex of sortedKeys) {
        const targetIndex = columnMappings[srcIndex];
        mappedRow[targetIndex] = row[srcIndex] ?? "";
      }
      
      return mappedRow;
    });

    onImport(mappedRows);
    onCancel();
  };

  const previewRows = useMemo(() => {
    if (!parsedData) return [];
    
    let rows = parsedData.rows;
    if (skipHeaderRow) {
      rows = rows.slice(1);
    }
    
    return rows.slice(0, 5);
  }, [parsedData, skipHeaderRow]);

  const finalRowCount = useMemo(() => {
    if (!parsedData) return 0;
    
    let count = parsedData.rows.length;
    if (skipHeaderRow) {
      count--;
    }
    return Math.max(0, count);
  }, [parsedData, skipHeaderRow]);

  const finalColumnCount = useMemo(() => {
    if (!parsedData) return 0;
    return Math.max(...parsedData.rows.map(r => r.length));
  }, [parsedData]);

  const canProceed = () => {
    if (step === 1) return file !== null;
    return true;
  };

  const getStepTitle = () => {
    switch (step) {
      case 1: return t("csv_import.select_file");
      case 2: return t("csv_import.column_mapping");
      case 3: return t("csv_import.import_options");
      case 4: return t("csv_import.final_preview");
      default: return "";
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 1: return t("csv_import.select_file_desc");
      case 2: return t("csv_import.column_mapping_desc");
      case 3: return t("csv_import.import_options_desc");
      case 4: return t("csv_import.final_preview_desc");
      default: return "";
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("csv_import.import")}</DialogTitle>
          <DialogDescription>{getStepDescription()}</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                  s === step
                    ? "bg-primary text-primary-foreground"
                    : s < step
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s < step ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 4 && (
                <div
                  className={`h-px flex-1 ${
                    s < step ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[300px]">
          {step === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <Label htmlFor="csv-file" className="cursor-pointer">
                  <span className="text-sm font-medium">
                    Click to select or drag and drop
                  </span>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv,.tsv,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </Label>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("csv_import.supported_formats")}
                </p>
              </div>
              {file && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm truncate">{file.name}</span>
                </div>
              )}
            </div>
          )}

          {step === 2 && parsedData && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                First 5 rows preview:
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Array.from({ length: Math.max(...parsedData.rows.map(r => r.length)) }).map((_, i) => (
                        <TableHead key={i}>Column {i + 1}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.rows.slice(0, 5).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {Array.from({ length: Math.max(...parsedData.rows.map(r => r.length)) }).map((_, colIndex) => (
                          <TableCell key={colIndex} className="max-w-[200px] truncate">
                            {row[colIndex] ?? ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Showing {Math.min(5, parsedData.rows.length)} of {parsedData.rows.length} rows
              </p>
            </div>
          )}

          {step === 3 && parsedData && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>{t("csv_import.delimiter")}</Label>
                <Select value={delimiter} onValueChange={(value) => value && setDelimiter(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIMITERS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="skip-header"
                  checked={skipHeaderRow}
                  onCheckedChange={(checked) => setSkipHeaderRow(!!checked)}
                />
                <Label htmlFor="skip-header">{t("csv_import.skip_header_row")}</Label>
              </div>

              <div className="space-y-2">
                <Label>{t("csv_import.live_preview")}</Label>
                <div className="border rounded-lg overflow-hidden max-h-64 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Array.from({ length: Math.max(...previewRows.map(r => r.length), 1) }).map((_, i) => (
                          <TableHead key={i}>Column {i + 1}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.slice(0, 5).map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {Array.from({ length: Math.max(...previewRows.map(r => r.length), 1) }).map((_, colIndex) => (
                            <TableCell key={colIndex} className="max-w-[200px] truncate">
                              {row[colIndex] ?? ""}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {step === 4 && parsedData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{finalRowCount}</div>
                  <div className="text-sm text-muted-foreground">
                    {t("csv_import.rows_to_import_other", { count: finalRowCount })}
                  </div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{finalColumnCount}</div>
                  <div className="text-sm text-muted-foreground">Columns</div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                Full preview:
              </div>
              <div className="border rounded-lg overflow-hidden max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Array.from({ length: finalColumnCount }).map((_, i) => (
                        <TableHead key={i}>Column {i + 1}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(skipHeaderRow ? parsedData.rows.slice(1) : parsedData.rows).slice(0, 20).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {Array.from({ length: finalColumnCount }).map((_, colIndex) => (
                          <TableCell key={colIndex} className="max-w-[200px] truncate">
                            {row[colIndex] ?? ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {finalRowCount > 20 && (
                <p className="text-xs text-muted-foreground">
                  Showing 20 of {finalRowCount} rows
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onCancel}>
            {t("csv_import.cancel")}
          </Button>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("common.back")}
              </Button>
            )}
            {step < 4 ? (
              <Button onClick={handleNext} disabled={!canProceed() || isProcessing}>
                {isProcessing ? "Processing..." : t("common.next")}
                {!isProcessing && <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
            ) : (
              <Button onClick={handleImport}>
                <Check className="h-4 w-4 mr-2" />
                {t("csv_import.import_button")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
