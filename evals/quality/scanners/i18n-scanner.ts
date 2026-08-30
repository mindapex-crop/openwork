/**
 * i18n completeness scanner core (L2 quality layer).
 *
 * Single source of truth for reading locale files and diffing message keys.
 * Both the legacy CLI (`scripts/i18n-audit.mjs`) and the L2 quality runner
 * (`evals/quality/run.ts`) import this module, so a key-set finding is always
 * computed the same way no matter which entry point produced it.
 *
 * Locale files are ES modules whose default export is a message object; nested
 * objects are flattened to dotted keys ("a.b.c"). Parsing is regex + eval based
 * (the same semantics `scripts/i18n-audit.mjs` always used) so it works on
 * source files with comments, spread imports, and `as const` annotations —
 * no compilation step involved.
 *
 *   scanI18nDirectory(localesDir, baseline?) -> I18nScanReport
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type Messages = Record<string, unknown>;

export interface LocaleKeyDiff {
  /** Keys present in the baseline locale but missing from the candidate. */
  missingKeys: string[];
  /** Keys present in the candidate but absent from the baseline. */
  extraKeys: string[];
}

export interface LocaleReport extends LocaleKeyDiff {
  locale: string;
  keyCount: number;
}

export interface I18nScanReport {
  generatedAt: string;
  baseline: string;
  baselineKeyCount: number;
  locales: LocaleReport[];
  totalMissingKeys: number;
  totalExtraKeys: number;
}

/** Bindings introduced by `import { x as y } from "./file"` statements. */
export function importedConstBindings(
  content: string,
  filePath: string,
): Map<string, { imported: string; sourcePath: string }> {
  const bindings = new Map();
  for (const match of content.matchAll(/import\s+\{([^}]+)\}\s+from\s+["'](\.[^"']+)["'];?/g)) {
    const source = match[2].endsWith(".ts") ? match[2] : `${match[2]}.ts`;
    const sourcePath = resolve(dirname(filePath), source);
    for (const specifier of match[1].split(",")) {
      const parts = specifier.trim().split(/\s+as\s+/);
      const imported = parts[0]?.trim();
      const local = parts[1]?.trim() ?? imported;
      if (!imported || !local || imported.startsWith("type ")) continue;
      bindings.set(local, { imported, sourcePath });
    }
  }
  return bindings;
}

/** Parse an exported `const <name> = {...} as const;` object from a TS file. */
export function parseExportedConst(filePath: string, exportName: string): Messages {
  const content = readFileSync(filePath, "utf-8");
  const escapedName = exportName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(
    new RegExp(`export\\s+const\\s+${escapedName}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s+as\\s+const;`),
  );
  if (!match) throw new Error(`Could not parse imported const ${exportName} from ${filePath}`);
  return new Function(`return {${match[1]}}`)() as Messages;
}

/** Parse a locale .ts file into a JS object via eval (mirrors the legacy CLI). */
export function parseLocale(filePath: string): Messages {
  const content = readFileSync(filePath, "utf-8");
  const match = content.match(/export default \{([\s\S]*?)\} as const;/);
  if (!match) throw new Error(`Could not parse ${filePath}`);

  const imported = importedConstBindings(content, filePath);
  const spreadNames = [...match[1].matchAll(/\.\.\.([A-Za-z_$][\w$]*)/g)]
    .map((spread) => spread[1]);
  const bindings = new Map();
  for (const name of spreadNames) {
    const source = imported.get(name);
    if (!source) continue;
    bindings.set(name, parseExportedConst(source.sourcePath, source.imported));
  }

  return new Function(...bindings.keys(), `return {${match[1]}}`)(...bindings.values()) as Messages;
}

/** Extract translation keys from a locale .ts file (as a Set). */
export function extractKeys(filePath: string): Set<string> {
  return new Set(Object.keys(parseLocale(filePath)));
}

/** Extract key→value map from a locale .ts file. */
export function extractKeyValues(filePath: string): Map<string, string> {
  return new Map(Object.entries(parseLocale(filePath)) as Array<[string, string]>);
}

/**
 * Find duplicate keys in a locale file. Must use regex — JSON.parse dedupes
 * silently, so it would hide exactly the bug this check exists to catch.
 */
export function findDuplicateKeys(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8");
  const seen = new Map();
  const dupes = [];
  for (const match of content.matchAll(/^\s*"([^"]+)"\s*:/gm)) {
    const key = match[1];
    if (seen.has(key)) dupes.push(key);
    else seen.set(key, true);
  }
  return dupes;
}

export function isMessageNode(value: unknown): value is Messages {
  return typeof value === "object" && value !== null;
}

/** Flatten a nested message tree into sorted dotted keys. */
export function collectFlatKeys(node: Messages, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    const keyPath = prefix === "" ? key : `${prefix}.${key}`;
    if (isMessageNode(value)) {
      keys.push(...collectFlatKeys(value, keyPath));
    } else {
      keys.push(keyPath);
    }
  }
  return keys.sort();
}

/** Directional key-set diff between a baseline and a candidate. */
export function diffKeys(
  baselineKeys: readonly string[],
  candidateKeys: readonly string[],
): LocaleKeyDiff {
  const baseline = new Set(baselineKeys);
  const candidate = new Set(candidateKeys);
  return {
    missingKeys: baselineKeys.filter((key) => !candidate.has(key)),
    extraKeys: candidateKeys.filter((key) => !baseline.has(key)),
  };
}

/**
 * Scan every locale .ts file in a directory (excluding index.ts) against a
 * baseline locale's key set. Report fields reconcile:
 * keyCount = baselineKeyCount - missingKeys.length + extraKeys.length.
 */
export function scanI18nDirectory(localesDir: string, baseline = "en"): I18nScanReport {
  const localeNames = readdirSync(localesDir)
    .filter((name) => name.endsWith(".ts") && name !== "index.ts")
    .map((name) => name.slice(0, -".ts".length))
    .sort();
  if (!localeNames.includes(baseline)) {
    throw new Error(`Baseline locale "${baseline}.ts" not found in ${localesDir}`);
  }
  const keyCounts = new Map<string, number>();
  const keySets = new Map<string, Set<string>>();
  for (const locale of localeNames) {
    const filePath = join(localesDir, `${locale}.ts`);
    const keys = extractKeys(filePath);
    keySets.set(locale, keys);
    keyCounts.set(locale, keys.size);
  }
  const baselineKeys = keySets.get(baseline);
  if (baselineKeys === undefined) {
    throw new Error(`Baseline locale "${baseline}" disappeared while scanning`);
  }
  const baselineSorted = [...baselineKeys].sort();
  const locales: LocaleReport[] = localeNames
    .filter((locale) => locale !== baseline)
    .map((locale) => {
      const keys = keySets.get(locale) ?? new Set<string>();
      return { locale, keyCount: keyCounts.get(locale) ?? 0, ...diffKeys(baselineSorted, [...keys].sort()) };
    });
  return {
    generatedAt: new Date().toISOString(),
    baseline,
    baselineKeyCount: baselineSorted.length,
    locales,
    totalMissingKeys: locales.reduce((sum, locale) => sum + locale.missingKeys.length, 0),
    totalExtraKeys: locales.reduce((sum, locale) => sum + locale.extraKeys.length, 0),
  };
}

/** Repo-root helpers kept for callers that want the canonical defaults. */
export function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}

export function defaultLocalesDir(): string {
  return join(repoRoot(), "apps/app/src/i18n/locales");
}

// ---------------------------------------------------------------------------
// CLI (node quality/scanners/i18n-scanner.ts [localesDir] [--baseline <locale>])
// Prints the scan report as JSON; exit 1 when any locale drifts from baseline.
// ---------------------------------------------------------------------------

function parseScanCliArgs(args: readonly string[]): { localesDir: string; baseline: string } {
  let localesDir = defaultLocalesDir();
  let baseline = "en";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) break;
    if (arg === "--baseline") {
      const value = args[index + 1];
      if (value === undefined) throw new Error("--baseline requires a value");
      baseline = value;
      index += 1;
    } else {
      localesDir = resolve(arg);
    }
  }
  return { localesDir, baseline };
}

async function scanMain(): Promise<number> {
  const { localesDir, baseline } = parseScanCliArgs(process.argv.slice(2));
  const report = scanI18nDirectory(localesDir, baseline);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  const drifting = report.locales.filter(
    (locale) => locale.missingKeys.length > 0 || locale.extraKeys.length > 0,
  );
  for (const locale of drifting) {
    process.stderr.write(
      `${locale.locale}: ${locale.missingKeys.length} missing / ${locale.extraKeys.length} extra keys ` +
        `(locale has ${locale.keyCount}, baseline "${report.baseline}" has ${report.baselineKeyCount})\n`,
    );
  }
  if (drifting.length > 0) {
    process.stderr.write(`i18n key drift detected in ${drifting.length}/${report.locales.length} locales\n`);
    return 1;
  }
  process.stderr.write(
    `All ${report.locales.length} locales match the "${report.baseline}" key set (${report.baselineKeyCount} keys)\n`,
  );
  return 0;
}

const invokedAsScanScript =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedAsScanScript) {
  process.exitCode = await scanMain();
}
