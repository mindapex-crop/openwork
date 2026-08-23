import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { test } from "@openwork/testkit";
import {
  collectFlatKeys,
  diffKeys,
  scanI18nDirectory,
} from "../quality/i18n-completeness/scan.ts";

const localesDir = fileURLToPath(
  new URL("../../apps/app/src/i18n/locales/", import.meta.url),
);

test("diffKeys separates keys missing from a locale from stray extras", async ({ evidence }) => {
  const diff = diffKeys(
    ["app.reload_later", "app.reload_now", "settings.title"],
    ["app.reload_now", "app.unknown_error", "settings.title"],
  );

  expect(diff.missingKeys).toEqual(["app.reload_later"]);
  expect(diff.extraKeys).toEqual(["app.unknown_error"]);
  evidence.recordAssertionEvidence(
    "Locale key diffs are deterministic and directional",
    "diffKeys flags baseline keys absent from the candidate as missing and candidate-only keys as extra; direction and ordering are stable.",
    true,
  );
});

test("collectFlatKeys flattens nested message trees into sorted dotted keys", async ({ evidence }) => {
  const keys = collectFlatKeys({
    app: { error: { auth: "Authentication failed" }, reload_now: "Reload now" },
    "settings.title": "Settings",
  });

  expect(keys).toEqual(["app.error.auth", "app.reload_now", "settings.title"]);
  evidence.recordAssertionEvidence(
    "Message keys flatten deterministically",
    "Nested message objects flatten to dotted key paths in sorted order, so key-set comparison is order-independent.",
    true,
  );
});

test("the shipped locale files scan against the en baseline with consistent accounting", async ({ evidence }) => {
  const report = await scanI18nDirectory(localesDir);

  expect(report.baseline).toBe("en");
  expect(report.locales.map((locale) => locale.locale)).toEqual([
    "ca",
    "es",
    "fr",
    "ja",
    "pt-BR",
    "ru",
    "th",
    "vi",
    "zh",
  ]);
  expect(report.baselineKeyCount).toBeGreaterThan(1000);
  for (const locale of report.locales) {
    expect(locale.keyCount).toBeGreaterThan(0);
    // The report must reconcile: a locale's key count equals the baseline
    // count minus its missing keys plus its extra keys.
    expect(locale.keyCount).toBe(
      report.baselineKeyCount - locale.missingKeys.length + locale.extraKeys.length,
    );
    // Missing and extra keys are sorted and never overlap.
    expect([...locale.missingKeys].sort()).toEqual(locale.missingKeys);
    expect([...locale.extraKeys].sort()).toEqual(locale.extraKeys);
    expect(locale.missingKeys.filter((key) => locale.extraKeys.includes(key))).toEqual([]);
  }
  expect(report.totalMissingKeys).toBe(
    report.locales.reduce((sum, locale) => sum + locale.missingKeys.length, 0),
  );
  expect(report.totalExtraKeys).toBe(
    report.locales.reduce((sum, locale) => sum + locale.extraKeys.length, 0),
  );
  const worst = [...report.locales].sort(
    (a, b) => b.missingKeys.length - a.missingKeys.length,
  )[0];
  evidence.recordAssertionEvidence(
    "The i18n scanner runs on the ten shipped locale files",
    `Baseline "en" has ${report.baselineKeyCount} keys; every locale reconciles (keyCount = baseline - missing + extra). ` +
      `Total drift: ${report.totalMissingKeys} missing / ${report.totalExtraKeys} extra across ${report.locales.length} locales; ` +
      `largest gap: ${worst?.locale ?? "n/a"} missing ${worst?.missingKeys.length ?? 0} keys.`,
    true,
  );
});
