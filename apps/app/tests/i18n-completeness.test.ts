import { describe, expect, test } from "bun:test";

import { setLocale, t } from "../src/i18n";
import en from "../src/i18n/locales/en";
import zh from "../src/i18n/locales/zh";

type Messages = Record<string, unknown>;

/** Flatten a (possibly nested) message object into dotted keys, matching the
 *  semantics of the i18n scanner (a.b.c). */
function flatten(obj: Messages, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      flatten(value as Messages, fullKey, out);
    } else {
      out[fullKey] = String(value);
    }
  }
  return out;
}

/** Collect the sorted set of `{placeholder}` tokens in a string. */
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[0]).sort();
}

function duplicates(keys: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) dupes.add(key);
    seen.add(key);
  }
  return [...dupes];
}

describe("i18n completeness: zh parity with en (regression)", () => {
  const enFlat = flatten(en);
  const zhFlat = flatten(zh);
  const enKeys = Object.keys(enFlat).sort();
  const zhKeys = Object.keys(zhFlat).sort();

  test("zh has no missing keys versus en (100% coverage)", () => {
    const missing = enKeys.filter((k) => !(k in zhFlat));
    expect(missing).toEqual([]);
  });

  test("zh has no orphan keys (no keys absent from en)", () => {
    const orphans = zhKeys.filter((k) => !(k in enFlat));
    expect(orphans).toEqual([]);
  });

  test("zh has no duplicate keys", () => {
    expect(duplicates(zhKeys)).toEqual([]);
  });

  test("every zh value preserves the exact {placeholder} tokens of its en source", () => {
    const mismatches: string[] = [];
    for (const key of enKeys) {
      const from = placeholders(enFlat[key] ?? "");
      const to = placeholders(zhFlat[key] ?? "");
      if (from.join() !== to.join()) mismatches.push(`${key}: ${from.join()} -> ${to.join()}`);
    }
    expect(mismatches).toEqual([]);
  });
});

describe("i18n runtime lookups under zh", () => {
  test("representative user-facing keys resolve to zh, not the en fallback", () => {
    setLocale("zh");
    expect(t("common.back")).toBe("返回");
    expect(t("welcome.title")).toBe("欢迎使用 OpenWork");
    expect(t("composer.steer")).toBe("发送");
    expect(t("session.cmd_settings_meta")).toBe("打开");
    expect(t("notifications.title")).toBe("通知");
    expect(t("session_detail.title")).toBe("会话详情");
  });

  test("missing key falls back to en value, and unknown key returns the key itself", () => {
    setLocale("zh");
    // zh === en coverage, so fallback still returns a valid translation here.
    expect(t("common.beta")).toBe("Beta");
    // A key that exists nowhere falls back to the raw key.
    expect(t("does.not.exist.anywhere")).toBe("does.not.exist.anywhere");
  });
});