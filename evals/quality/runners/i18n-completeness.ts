/**
 * i18n completeness domain runner (L2).
 *
 * Executes the deterministic scanner over the locale directory named by the
 * golden case input, then reduces the raw report to a judge-friendly shape:
 * structured `report`, an `invariants` list (the quality gates), and `drift`
 * stats (the i18n refactor worklist). No LLM in the loop.
 */
import type { GoldenCase } from "../judge.ts";
import {
  scanI18nDirectory,
  findDuplicateKeys,
  defaultLocalesDir,
  repoRoot,
  type I18nScanReport,
} from "../scanners/i18n-scanner.ts";
import { join, isAbsolute, resolve } from "node:path";
import { existsSync } from "node:fs";

export interface I18nInvariant {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface I18nActual {
  report: I18nScanReport;
  invariants: I18nInvariant[];
  drift: {
    totalMissingKeys: number;
    totalExtraKeys: number;
    driftingLocales: string[];
  };
}

/** Resolve a locales dir from the case input, defaulting to the app's locales. */
export function resolveLocalesDir(input: Record<string, unknown>): string {
  const raw = input.localesDir;
  if (typeof raw !== "string" || raw.trim() === "") return defaultLocalesDir();
  return isAbsolute(raw) ? raw : resolve(repoRoot(), raw);
}

export function runI18nCompletenessCase(caseDef: GoldenCase): I18nActual {
  const localesDir = resolveLocalesDir(caseDef.input);
  const baseline = typeof caseDef.input.baseline === "string" ? caseDef.input.baseline : "en";
  const report = scanI18nDirectory(localesDir, baseline);

  const invariants: I18nInvariant[] = [];

  invariants.push({
    name: "baseline-is-source-of-truth",
    passed: report.baselineKeyCount > 0,
    detail: `baseline "${report.baseline}" has ${report.baselineKeyCount} keys`,
  });

  const reconcileFailures = report.locales.filter(
    (locale) => locale.keyCount !== report.baselineKeyCount - locale.missingKeys.length + locale.extraKeys.length,
  );
  invariants.push({
    name: "report-reconciles",
    passed: reconcileFailures.length === 0,
    detail: reconcileFailures.length === 0
      ? "every locale keyCount reconciles as baseline - missing + extra"
      : `locales that do not reconcile: ${reconcileFailures.map((l) => l.locale).join(", ")}`,
  });

  const orderingFailures = report.locales.filter(
    (locale) =>
      JSON.stringify(locale.missingKeys) !== JSON.stringify([...locale.missingKeys].sort())
      || JSON.stringify(locale.extraKeys) !== JSON.stringify([...locale.extraKeys].sort())
      || locale.missingKeys.some((key) => locale.extraKeys.includes(key)),
  );
  invariants.push({
    name: "diffs-sorted-and-disjoint",
    passed: orderingFailures.length === 0,
    detail: orderingFailures.length === 0 ? "all diffs are sorted and missing/extra never overlap" : `violations: ${orderingFailures.map((l) => l.locale).join(", ")}`,
  });

  const duplicated: string[] = [];
  for (const locale of [...report.locales.map((l) => l.locale), report.baseline]) {
    const filePath = join(localesDir, `${locale}.ts`);
    if (!existsSync(filePath)) continue;
    const dupes = findDuplicateKeys(filePath);
    if (dupes.length > 0) duplicated.push(`${locale}: ${dupes.join(", ")}`);
  }
  invariants.push({
    name: "no-duplicate-keys",
    passed: duplicated.length === 0,
    detail: duplicated.length === 0 ? "no locale file contains duplicate keys" : `duplicates: ${duplicated.join("; ")}`,
  });

  const driftingLocales = report.locales
    .filter((locale) => locale.missingKeys.length > 0 || locale.extraKeys.length > 0)
    .map((locale) => locale.locale);

  return {
    report,
    invariants,
    drift: {
      totalMissingKeys: report.totalMissingKeys,
      totalExtraKeys: report.totalExtraKeys,
      driftingLocales,
    },
  };
}
