/**
 * Deterministic i18n completeness scanner (L2 quality layer).
 *
 * Compares the message-key set of every locale file in a locales directory
 * (default: apps/app/src/i18n/locales) against the "en" baseline. Locale
 * files are ES modules with a default export of message objects; nested
 * objects are flattened to dotted keys ("a.b.c"). Missing and extra keys are
 * reported verbatim — no fuzzy matching, no model in the loop, fully
 * reproducible on any machine.
 *
 * Library use:
 *   scanI18nDirectory(localesDir, baseline?) -> Promise<I18nScanReport>
 *
 * CLI use (Node >= 24 strips types natively):
 *   node quality/i18n-completeness/scan.ts [localesDir] [--baseline <locale>] [--out <file>]
 *
 * Exit code 1 when any locale drifts from the baseline key set.
 */
import { readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
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

const DEFAULT_LOCALES_DIR_URL = new URL(
  "../../../apps/app/src/i18n/locales",
  import.meta.url,
);

function isMessageNode(value: unknown): value is Messages {
  return typeof value === "object" && value !== null;
}

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

type LocaleModule = { default: Messages };

async function importLocaleModule(fileUrl: string): Promise<LocaleModule> {
  return import(fileUrl);
}

export async function scanI18nDirectory(
  localesDir: string,
  baseline = "en",
): Promise<I18nScanReport> {
  const entries = await readdir(localesDir);
  const localeNames = entries
    .filter((name) => name.endsWith(".ts") && name !== "index.ts")
    .map((name) => name.slice(0, -".ts".length))
    .sort();
  if (!localeNames.includes(baseline)) {
    throw new Error(`Baseline locale "${baseline}.ts" not found in ${localesDir}`);
  }
  const keysByLocale = new Map<string, string[]>();
  for (const locale of localeNames) {
    const localeModule = await importLocaleModule(
      pathToFileURL(join(localesDir, `${locale}.ts`)).href,
    );
    if (!isMessageNode(localeModule.default)) {
      throw new Error(`Locale file ${locale}.ts must default-export a message object`);
    }
    keysByLocale.set(locale, collectFlatKeys(localeModule.default));
  }
  const baselineKeys = keysByLocale.get(baseline);
  if (baselineKeys === undefined) {
    throw new Error(`Baseline locale "${baseline}" disappeared while scanning`);
  }
  const locales: LocaleReport[] = localeNames
    .filter((locale) => locale !== baseline)
    .map((locale) => {
      const keys = keysByLocale.get(locale) ?? [];
      return { locale, keyCount: keys.length, ...diffKeys(baselineKeys, keys) };
    });
  return {
    generatedAt: new Date().toISOString(),
    baseline,
    baselineKeyCount: baselineKeys.length,
    locales,
    totalMissingKeys: locales.reduce((sum, locale) => sum + locale.missingKeys.length, 0),
    totalExtraKeys: locales.reduce((sum, locale) => sum + locale.extraKeys.length, 0),
  };
}

interface CliOptions {
  localesDir: string;
  baseline: string;
  outPath: string | undefined;
}

function parseCliArgs(args: readonly string[]): CliOptions {
  let localesDir: string | undefined;
  let baseline = "en";
  let outPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) break;
    if (arg === "--out" || arg === "--baseline") {
      const value = args[index + 1];
      if (value === undefined) throw new Error(`${arg} requires a value`);
      if (arg === "--out") outPath = value;
      else baseline = value;
      index += 1;
    } else if (localesDir === undefined) {
      localesDir = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  return {
    localesDir: localesDir ?? fileURLToPath(DEFAULT_LOCALES_DIR_URL),
    baseline,
    outPath,
  };
}

async function main(): Promise<number> {
  const { localesDir, baseline, outPath } = parseCliArgs(process.argv.slice(2));
  const report = await scanI18nDirectory(localesDir, baseline);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (outPath === undefined) {
    process.stdout.write(json);
  } else {
    await writeFile(outPath, json, "utf8");
    process.stderr.write(`Report written to ${outPath}\n`);
  }
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
    process.stderr.write(
      `i18n key drift detected in ${drifting.length}/${report.locales.length} locales\n`,
    );
    return 1;
  }
  process.stderr.write(
    `All ${report.locales.length} locales match the "${report.baseline}" key set (${report.baselineKeyCount} keys)\n`,
  );
  return 0;
}

const invokedAsScript =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedAsScript) {
  process.exitCode = await main();
}
