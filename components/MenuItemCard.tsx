"use client";

import type { Category, MenuItem } from "@/lib/menu";
import type { Lang } from "@/lib/i18n";
import { fmtMoney, t } from "@/lib/i18n";
import { priceFor } from "@/lib/menu";
import type { OrderEntry, Participant } from "@/lib/room";

type Props = {
  item: MenuItem;
  categories: Category[];
  lang: Lang;
  /** Entries for this menu item, in chronological order. */
  entries: OrderEntry[];
  meId: string;
  participants: Participant[];
  onAdd: () => void;
  busy?: boolean;
};

export function MenuItemCard({
  item,
  categories,
  lang,
  entries,
  meId,
  participants,
  onAdd,
  busy,
}: Props) {
  const totalQty = entries.reduce((sum, e) => sum + e.qty, 0);
  const mineQty = entries
    .filter((e) => e.userId === meId)
    .reduce((sum, e) => sum + e.qty, 0);
  const hasOthers = entries.some((e) => e.userId !== meId);

  const orderedByMap = new Map<string, number>();
  for (const e of entries) {
    orderedByMap.set(e.userId, (orderedByMap.get(e.userId) ?? 0) + e.qty);
  }
  const orderedBy = Array.from(orderedByMap.entries())
    .map(([userId, qty]) => {
      const p = participants.find((pp) => pp.id === userId);
      return { p, qty, isMe: userId === meId };
    })
    .filter((x): x is { p: Participant; qty: number; isMe: boolean } => Boolean(x.p));

  const price = priceFor(item, categories);

  const wrapper =
    totalQty > 0
      ? hasOthers
        ? "border-amber-300 bg-amber-50/60"
        : "border-sage/40 bg-sage/5"
      : "border-ink/10 bg-white";

  return (
    <div
      className={`group relative flex gap-3 rounded-2xl border p-3 shadow-card transition ${wrapper}`}
    >
      <div className="flex w-12 shrink-0 flex-col items-center gap-1">
        {item.code && (
          <span className="rounded-md bg-ink/5 px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-ink/60">
            {item.code}
          </span>
        )}
        {price > 0 && (
          <span className="text-[11px] font-medium tabular-nums text-ink/50">
            {fmtMoney(price, lang)}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight">
              {lang === "zh" ? item.zh : item.en}
            </p>
            <p className="truncate text-[12px] leading-tight text-ink/50">
              {lang === "zh" ? item.en : item.zh}
              {(item.unitZh || item.unitEn) && (
                <span className="ml-1 text-ink/40">
                  · {lang === "zh" ? item.unitZh ?? item.unitEn : item.unitEn ?? item.unitZh}
                </span>
              )}
            </p>
          </div>

          <AddButton
            onClick={onAdd}
            disabled={busy}
            highlight={hasOthers}
            qty={totalQty}
            lang={lang}
          />
        </div>

        {totalQty > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {hasOthers && (
              <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                {t("alreadyOrdered", lang)}
              </span>
            )}
            {mineQty > 0 && (
              <span className="rounded-full bg-sage/20 px-2 py-0.5 text-[11px] font-medium text-emerald-900">
                {t("yoursTag", lang)} ×{mineQty}
              </span>
            )}
            {orderedBy
              .filter((x) => !x.isMe)
              .map(({ p, qty }) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ring-ink/10"
                  title={p.name}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: `hsl(${p.hue} 65% 42%)` }}
                  />
                  {p.name} ×{qty}
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddButton({
  onClick,
  disabled,
  highlight,
  qty,
  lang,
}: {
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
  qty: number;
  lang: Lang;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "relative inline-flex h-10 min-w-[68px] shrink-0 items-center justify-center gap-1 rounded-xl px-3 text-sm font-semibold transition active:scale-95 disabled:opacity-50 " +
        (qty > 0
          ? "bg-ink text-white"
          : highlight
            ? "bg-amber-500 text-white"
            : "bg-accent text-white")
      }
      aria-label={t("add", lang)}
    >
      <span aria-hidden className="text-base leading-none">+</span>
      <span>{t("add", lang)}</span>
      {qty > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-ink ring-2 ring-paper">
          {qty}
        </span>
      )}
    </button>
  );
}
