"use client";

import type { Lang } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { MenuItem } from "@/lib/menu";

export function DuplicateConfirm({
  item,
  otherNames,
  lang,
  onCancel,
  onConfirm,
}: {
  item: MenuItem;
  otherNames: string[];
  lang: Lang;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 safe-bottom sm:items-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-base font-semibold leading-tight">
          {t("someoneAlsoOrdered", lang, {
            name: otherNames.join(", "),
          })}
        </h3>
        <p className="mt-2 text-sm text-ink/60">
          <span className="font-medium text-ink/80">
            {item.code} · {lang === "zh" ? item.zh : item.en}
          </span>
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-11 items-center justify-center rounded-xl border border-ink/15 bg-paper text-sm font-semibold active:scale-95"
          >
            {t("duplicateCancel", lang)}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex h-11 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-white active:scale-95"
          >
            {t("duplicateOk", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
