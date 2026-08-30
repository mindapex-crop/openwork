/**
 * Pure formula engine for spreadsheet calculations
 * No React dependencies - pure functions only
 */

export interface CellReference {
  col: number;
  row: number;
}

/**
 * Parse a cell reference like "A1", "B2", "C3" into column and row numbers
 * Column: A=0, B=1, C=2, etc.
 * Row: 1-based (as displayed in spreadsheet)
 */
export function parseCellReference(ref: string): CellReference {
  const match = ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  
  if (!match) {
    throw new Error(`Invalid cell reference: ${ref}`);
  }

  const colLetters = match[1];
  const rowNumber = parseInt(match[2], 10);

  // Convert column letters to number (A=0, B=1, ..., Z=25, AA=26, etc.)
  // This is like a base-26 system but without zero
  let col = 0;
  for (let i = 0; i < colLetters.length; i++) {
    col = col * 26 + (colLetters.charCodeAt(i) - 64);
  }
  col -= 1; // Convert from 1-based to 0-based

  return { col, row: rowNumber };
}

/**
 * Convert column number back to letters (0=A, 1=B, etc.)
 */
function colToLetters(col: number): string {
  let result = "";
  let n = col + 1; // Convert from 0-based to 1-based
  
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  
  return result;
}

/**
 * Get all cells in a range from startRef to endRef (inclusive)
 * e.g., getRangeCells("A1", "A5") returns ["A1", "A2", "A3", "A4", "A5"]
 * e.g., getRangeCells("A1", "B2") returns ["A1", "A2", "B1", "B2"]
 */
export function getRangeCells(startRef: string, endRef: string): string[] {
  const start = parseCellReference(startRef);
  const end = parseCellReference(endRef);

  const cells: string[] = [];
  
  for (let col = start.col; col <= end.col; col++) {
    for (let row = start.row; row <= end.row; row++) {
      cells.push(`${colToLetters(col)}${row}`);
    }
  }

  return cells;
}

/**
 * Check if a formula has circular references
 * Returns true if the formula references the current cell directly or indirectly
 */
export function hasCircularReference(
  formula: string,
  currentCell: string,
  visited: Set<string> = new Set()
): boolean {
  if (visited.has(currentCell)) {
    return true;
  }

  const normalizedCurrent = currentCell.toUpperCase();
  visited.add(normalizedCurrent);

  // Extract all cell references from the formula
  const cellRefs = extractCellReferences(formula);
  
  for (const ref of cellRefs) {
    if (ref.toUpperCase() === normalizedCurrent) {
      return true;
    }
  }

  return false;
}

/**
 * Extract all cell references from a formula string
 * Returns array of cell references like ["A1", "B2", "C3"]
 */
function extractCellReferences(formula: string): string[] {
  const refs: string[] = [];
  const regex = /\b([A-Z]+\d+)\b/gi;
  let match;

  while ((match = regex.exec(formula)) !== null) {
    refs.push(match[1]);
  }

  return refs;
}

/**
 * Evaluate a formula string and return numeric result or error string
 * @param formula - The formula string (e.g., "=SUM(A1:A5)", "=A1+B2")
 * @param cellData - Record mapping cell references to their values
 * @returns number or error string
 */
export function evaluateFormula(
  formula: string,
  cellData: Record<string, string>
): number | string {
  // If formula doesn't start with "=", treat as plain value
  if (!formula.startsWith("=")) {
    const num = Number(formula);
    return isNaN(num) ? formula : num;
  }

  const expression = formula.substring(1).trim();

  try {
    // Parse and evaluate the expression
    return evaluateExpression(expression, cellData);
  } catch (error) {
    if (error instanceof CircularReferenceError) {
      return "#CIRCULAR!";
    }
    return "#ERROR!";
  }
}

class CircularReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircularReferenceError";
  }
}

/**
 * Evaluate a mathematical/logical expression with cell references and functions
 */
function evaluateExpression(
  expression: string,
  cellData: Record<string, string>,
  evaluatingCells: Set<string> = new Set()
): number {
  // Handle function calls first (SUM, AVG, MIN, MAX, COUNT)
  const funcMatch = expression.match(/^(\w+)\((.+)\)$/i);
  if (funcMatch) {
    const funcName = funcMatch[1].toUpperCase();
    const args = funcMatch[2];
    
    switch (funcName) {
      case "SUM":
        return evaluateSum(args, cellData, evaluatingCells);
      case "AVG":
      case "AVERAGE":
        return evaluateAvg(args, cellData, evaluatingCells);
      case "MIN":
        return evaluateMin(args, cellData, evaluatingCells);
      case "MAX":
        return evaluateMax(args, cellData, evaluatingCells);
      case "COUNT":
        return evaluateCount(args, cellData, evaluatingCells);
      default:
        throw new Error(`Unknown function: ${funcName}`);
    }
  }

  // Replace cell references with their values
  const resolved = resolveCellReferences(expression, cellData, evaluatingCells);

  // Evaluate the arithmetic expression
  return evaluateArithmetic(resolved);
}

/**
 * Resolve cell references in an expression to their numeric values
 */
function resolveCellReferences(
  expression: string,
  cellData: Record<string, string>,
  evaluatingCells: Set<string>
): string {
  return expression.replace(/\b([A-Z]+\d+)\b/gi, (match) => {
    const cellRef = match.toUpperCase();
    
    // Check for circular reference
    if (evaluatingCells.has(cellRef)) {
      throw new CircularReferenceError(`Circular reference detected: ${cellRef}`);
    }

    const value = cellData[cellRef];
    
    if (value === undefined || value === "") {
      return "0";
    }

    // If the cell contains a formula, we need to detect circular references
    if (value.startsWith("=")) {
      evaluatingCells.add(cellRef);
      try {
        const result = evaluateExpression(value.substring(1), cellData, evaluatingCells);
        return String(result);
      } finally {
        evaluatingCells.delete(cellRef);
      }
    }

    const num = Number(value);
    return isNaN(num) ? "0" : String(num);
  });
}

/**
 * Evaluate SUM function: =SUM(A1:A5) or =SUM(A1,B1,C1)
 */
function evaluateSum(
  args: string,
  cellData: Record<string, string>,
  evaluatingCells: Set<string>
): number {
  const values = collectValues(args, cellData, evaluatingCells);
  return values.reduce((sum, val) => sum + val, 0);
}

/**
 * Evaluate AVG/AVERAGE function: =AVG(B1:B10)
 */
function evaluateAvg(
  args: string,
  cellData: Record<string, string>,
  evaluatingCells: Set<string>
): number {
  const values = collectValues(args, cellData, evaluatingCells);
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Evaluate MIN function: =MIN(A1:A5)
 */
function evaluateMin(
  args: string,
  cellData: Record<string, string>,
  evaluatingCells: Set<string>
): number {
  const values = collectValues(args, cellData, evaluatingCells);
  if (values.length === 0) return 0;
  return Math.min(...values);
}

/**
 * Evaluate MAX function: =MAX(A1:A5)
 */
function evaluateMax(
  args: string,
  cellData: Record<string, string>,
  evaluatingCells: Set<string>
): number {
  const values = collectValues(args, cellData, evaluatingCells);
  if (values.length === 0) return 0;
  return Math.max(...values);
}

/**
 * Evaluate COUNT function: =COUNT(A1:A5)
 */
function evaluateCount(
  args: string,
  cellData: Record<string, string>,
  evaluatingCells: Set<string>
): number {
  const values = collectValues(args, cellData, evaluatingCells);
  return values.length;
}

/**
 * Collect numeric values from arguments (ranges or individual cells)
 */
function collectValues(
  args: string,
  cellData: Record<string, string>,
  evaluatingCells: Set<string>
): number[] {
  const values: number[] = [];
  
  // Split by comma for multiple arguments
  const parts = args.split(",");
  
  for (const part of parts) {
    const trimmed = part.trim();
    
    // Check if it's a range (e.g., A1:A5 or A1 : A5)
    const rangeMatch = trimmed.match(/^([A-Z]+\d+)\s*:\s*([A-Z]+\d+)$/i);
    if (rangeMatch) {
      const cells = getRangeCells(rangeMatch[1], rangeMatch[2]);
      for (const cell of cells) {
        const value = getCellValue(cell, cellData, evaluatingCells);
        values.push(value);
      }
    } else {
      // Individual cell reference
      const value = getCellValue(trimmed, cellData, evaluatingCells);
      values.push(value);
    }
  }
  
  return values;
}

/**
 * Get numeric value from a cell reference
 */
function getCellValue(
  cellRef: string,
  cellData: Record<string, string>,
  evaluatingCells: Set<string>
): number {
  const normalized = cellRef.toUpperCase();
  
  if (evaluatingCells.has(normalized)) {
    throw new CircularReferenceError(`Circular reference detected: ${normalized}`);
  }

  const value = cellData[normalized];
  
  if (value === undefined || value === "") {
    return 0;
  }

  // If the cell contains a formula, evaluate it
  if (value.startsWith("=")) {
    evaluatingCells.add(normalized);
    try {
      const result = evaluateExpression(value.substring(1), cellData, evaluatingCells);
      return result;
    } finally {
      evaluatingCells.delete(normalized);
    }
  }

  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Evaluate a simple arithmetic expression
 * Supports: +, -, *, /, parentheses
 * Uses safe evaluation instead of eval()
 */
function evaluateArithmetic(expression: string): number {
  // Tokenize
  const tokens = tokenize(expression);
  
  // Parse and evaluate using recursive descent parser
  const result = parseExpression(tokens, { pos: 0 });
  
  return result;
}

interface Token {
  type: "number" | "operator" | "paren";
  value: string;
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  
  while (i < expression.length) {
    const char = expression[i];
    
    // Skip whitespace
    if (char === " ") {
      i++;
      continue;
    }
    
    // Negative sign at start or after operator/paren - must check before operators
    if (char === "-" && (tokens.length === 0 || tokens[tokens.length - 1].type === "operator" || tokens[tokens.length - 1].value === "(")) {
      // Look ahead for number
      let j = i + 1;
      while (j < expression.length && expression[j] === " ") j++;
      
      if (j < expression.length && (/\d/.test(expression[j]) || expression[j] === ".")) {
        let num = "-";
        i = j;
        while (i < expression.length && (/\d/.test(expression[i]) || expression[i] === ".")) {
          num += expression[i];
          i++;
        }
        tokens.push({ type: "number", value: num });
        continue;
      }
    }
    
    // Numbers (including decimals)
    if (/\d/.test(char) || (char === "." && i + 1 < expression.length && /\d/.test(expression[i + 1]))) {
      let num = "";
      while (i < expression.length && (/\d/.test(expression[i]) || expression[i] === ".")) {
        num += expression[i];
        i++;
      }
      tokens.push({ type: "number", value: num });
      continue;
    }
    
    // Operators (+, *, / but not - which was handled above)
    if ("+*/".includes(char)) {
      tokens.push({ type: "operator", value: char });
      i++;
      continue;
    }
    
    // Handle minus as operator only when not a negative sign
    if (char === "-") {
      tokens.push({ type: "operator", value: char });
      i++;
      continue;
    }
    
    // Parentheses
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      i++;
      continue;
    }
    
    throw new Error(`Unexpected character: ${char}`);
  }
  
  return tokens;
}

interface ParserState {
  pos: number;
}

function parseExpression(tokens: Token[], state: ParserState): number {
  let left = parseTerm(tokens, state);
  
  while (state.pos < tokens.length) {
    const token = tokens[state.pos];
    
    if (token.type === "operator" && (token.value === "+" || token.value === "-")) {
      state.pos++;
      const right = parseTerm(tokens, state);
      left = token.value === "+" ? left + right : left - right;
    } else {
      break;
    }
  }
  
  return left;
}

function parseTerm(tokens: Token[], state: ParserState): number {
  let left = parseFactor(tokens, state);
  
  while (state.pos < tokens.length) {
    const token = tokens[state.pos];
    
    if (token.type === "operator" && (token.value === "*" || token.value === "/")) {
      state.pos++;
      const right = parseFactor(tokens, state);
      left = token.value === "*" ? left * right : left / right;
    } else {
      break;
    }
  }
  
  return left;
}

function parseFactor(tokens: Token[], state: ParserState): number {
  const token = tokens[state.pos];
  
  if (!token) {
    throw new Error("Unexpected end of expression");
  }
  
  // Number
  if (token.type === "number") {
    state.pos++;
    return parseFloat(token.value);
  }
  
  // Parenthesized expression
  if (token.type === "paren" && token.value === "(") {
    state.pos++; // skip '('
    const result = parseExpression(tokens, state);
    
    if (state.pos >= tokens.length || tokens[state.pos].value !== ")") {
      throw new Error("Missing closing parenthesis");
    }
    state.pos++; // skip ')'
    
    return result;
  }
  
  throw new Error(`Unexpected token: ${token.value}`);
}
