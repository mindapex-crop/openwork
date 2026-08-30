import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { dictionaries, resolveLanguage, translate, type Language } from "./strings";

const STORAGE_KEY = "openwork.mobile.lang";

export interface I18nContextValue {
  lang: Language;
  /** 切换语言（持久化到 AsyncStorage） */
  setLang: (lang: Language) => void;
  /** 恢复为跟随设备语言（清除持久化偏好） */
  resetToSystem: () => void;
  /** 翻译函数 */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** 当前语言的显示名（如 "简体中文" / "English"） */
  languageLabel: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const LANGUAGE_LABELS: Record<Language, string> = {
  zh: "简体中文",
  en: "English",
};

function detectSystemLanguage(): Language {
  try {
    const locales = Localization.getLocales();
    return resolveLanguage(locales?.[0]?.languageCode);
  } catch {
    return "en";
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [lang, setLangState] = useState<Language>(() => detectSystemLanguage());
  const [hydrated, setHydrated] = useState(false);

  // 启动时读取持久化的语言偏好（覆盖设备语言）
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored === "zh" || stored === "en") {
          setLangState(stored);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const resetToSystem = useCallback(() => {
    setLangState(detectSystemLanguage());
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, resetToSystem, t, languageLabel: LANGUAGE_LABELS[lang] }),
    [lang, setLang, resetToSystem, t],
  );

  // 未完成持久化读取前不渲染子树，避免语言闪烁（首帧跟随系统语言）
  if (!hydrated) return <>{null}</>;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within LanguageProvider");
  }
  return ctx;
}

export { dictionaries, resolveLanguage, translate };
export type { Language };
