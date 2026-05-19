"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lang } from "./i18n";

const KEY = "dimsum:lang";

function detect(): Lang {
  if (typeof navigator === "undefined") return "zh";
  const nav = navigator.language?.toLowerCase() ?? "";
  return nav.startsWith("zh") ? "zh" : "en";
}

export function useLang(): [Lang, (next: Lang) => void, () => void] {
  // Use a deterministic initial value so SSR markup matches the first client render.
  const [lang, setLang] = useState<Lang>("zh");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY) as Lang | null;
      const next = stored ?? detect();
      setLang(next);
      document.documentElement.lang = next === "zh" ? "zh-Hant" : "en";
    } catch {
      /* localStorage may be unavailable in private mode */
    }
  }, []);

  const set = useCallback((next: Lang) => {
    setLang(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* noop */
    }
    document.documentElement.lang = next === "zh" ? "zh-Hant" : "en";
  }, []);

  const toggle = useCallback(() => {
    set(lang === "zh" ? "en" : "zh");
  }, [lang, set]);

  return [lang, set, toggle];
}
