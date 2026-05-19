"use client";

import type { Lang } from "@/lib/i18n";
import { t } from "@/lib/i18n";

export function LangToggle({
  lang,
  onToggle,
  className = "",
}: {
  lang: Lang;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Switch language"
      className={
        "inline-flex h-9 min-w-[3.5rem] items-center justify-center gap-1 rounded-full border border-ink/15 bg-white px-3 text-sm font-medium text-ink/80 shadow-sm transition active:scale-95 " +
        className
      }
    >
      <span className={lang === "zh" ? "text-ink" : "text-ink/30"}>中</span>
      <span className="text-ink/20">/</span>
      <span className={lang === "en" ? "text-ink" : "text-ink/30"}>EN</span>
    </button>
  );
}
