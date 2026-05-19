"use client";

import { useEffect, useRef } from "react";
import type { Category } from "@/lib/menu";
import type { Lang } from "@/lib/i18n";
import { t } from "@/lib/i18n";

export function CategoryTabs({
  categories,
  active,
  onSelect,
  lang,
}: {
  categories: Category[];
  active: string | "all";
  onSelect: (id: string | "all") => void;
  lang: Lang;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLButtonElement>(
      `[data-cat="${active}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  return (
    <div
      ref={ref}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-2 scrollbar-none"
      role="tablist"
    >
      <TabButton
        active={active === "all"}
        onClick={() => onSelect("all")}
        data-cat="all"
      >
        {t("categoryAll", lang)}
      </TabButton>
      {categories.map((c) => (
        <TabButton
          key={c.id}
          active={active === c.id}
          onClick={() => onSelect(c.id)}
          data-cat={c.id}
        >
          {lang === "zh" ? c.zh : c.en}
        </TabButton>
      ))}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  ...rest
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition " +
        (active
          ? "border-accent bg-accent text-white shadow-sm"
          : "border-ink/15 bg-white text-ink/70 active:scale-95")
      }
      {...rest}
    >
      {children}
    </button>
  );
}
