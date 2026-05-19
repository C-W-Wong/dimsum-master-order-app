"use client";

import { useMemo } from "react";
import type { Lang } from "@/lib/i18n";
import { fmtMoney, t } from "@/lib/i18n";
import { findCategory, findItem, priceFor } from "@/lib/menu";
import { ordersByItem, type OrderEntry, type Participant, type Room } from "@/lib/room";

export function BasketSheet({
  open,
  onClose,
  room,
  meId,
  lang,
  onAdjust,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  room: Room;
  meId: string;
  lang: Lang;
  onAdjust: (entry: OrderEntry, qty: number) => void;
  onRemove: (entry: OrderEntry) => void;
}) {
  const grouped = useMemo(() => ordersByItem(room.orders), [room.orders]);
  const total = useMemo(
    () =>
      room.orders.reduce((sum, e) => {
        const item = findItem(room.menu, e.itemId);
        return sum + (item ? priceFor(item, room.menu.categories) * e.qty : 0);
      }, 0),
    [room.orders, room.menu]
  );
  const totalCount = room.orders.reduce((sum, e) => sum + e.qty, 0);

  return (
    <div
      className={
        "fixed inset-0 z-40 transition " +
        (open ? "pointer-events-auto" : "pointer-events-none")
      }
      aria-hidden={!open}
    >
      <div
        className={
          "absolute inset-0 bg-ink/40 transition-opacity " +
          (open ? "opacity-100" : "opacity-0")
        }
        onClick={onClose}
      />
      <section
        className={
          "absolute inset-x-0 bottom-0 mx-auto flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-paper shadow-2xl transition-transform safe-bottom " +
          (open ? "translate-y-0" : "translate-y-full")
        }
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between gap-3 px-5 pt-4">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-ink/15" />
        </header>
        <div className="flex items-baseline justify-between px-5 pt-2">
          <h2 className="text-lg font-semibold">{t("basket", lang)}</h2>
          <span className="text-xs text-ink/50">
            {t("totalItems", lang, { n: totalCount })}
          </span>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto px-5 pb-4">
          {room.orders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-ink/15 bg-white px-4 py-8 text-center text-sm text-ink/50">
              {t("basketEmpty", lang)}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {Array.from(grouped.entries()).map(([itemId, entries]) => {
                const item = findItem(room.menu, itemId);
                if (!item) return null;
                const cat = findCategory(room.menu, item.category);
                return (
                  <li
                    key={itemId}
                    className="rounded-2xl border border-ink/10 bg-white p-3 shadow-card"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold leading-tight">
                          {item.code && (
                            <span className="mr-1.5 text-[11px] font-bold tracking-wider text-ink/40">
                              {item.code}
                            </span>
                          )}
                          {lang === "zh" ? item.zh : item.en}
                        </p>
                        <p className="truncate text-[12px] text-ink/50">
                          {lang === "zh" ? item.en : item.zh}
                          {cat && (
                            <span className="ml-1 text-ink/40">
                              · {lang === "zh" ? cat.zh : cat.en}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-ink/70">
                        {fmtMoney(priceFor(item, room.menu.categories), lang)}
                      </span>
                    </div>

                    <ul className="mt-2 space-y-1.5">
                      {entries.map((e) => (
                        <EntryRow
                          key={e.id}
                          entry={e}
                          meId={meId}
                          participant={room.participants.find(
                            (p) => p.id === e.userId
                          )}
                          lang={lang}
                          onAdjust={onAdjust}
                          onRemove={onRemove}
                        />
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="border-t border-ink/10 bg-white px-5 pb-5 pt-4 safe-bottom">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-ink/60">
              {t("subtotal", lang)}
            </span>
            <span className="text-xl font-bold tabular-nums">
              {fmtMoney(total, lang)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-ink/40">
            {lang === "zh"
              ? "供參考，未含稅金與飲料外點。"
              : "Estimate only — tax not included."}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-ink text-base font-semibold text-white transition active:scale-[0.98]"
          >
            {lang === "zh" ? "繼續點餐" : "Keep browsing"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function EntryRow({
  entry,
  meId,
  participant,
  lang,
  onAdjust,
  onRemove,
}: {
  entry: OrderEntry;
  meId: string;
  participant?: Participant;
  lang: Lang;
  onAdjust: (entry: OrderEntry, qty: number) => void;
  onRemove: (entry: OrderEntry) => void;
}) {
  const mine = entry.userId === meId;
  const hue = participant?.hue ?? 0;
  const name = participant?.name ?? entry.userName;

  return (
    <li className="flex items-center justify-between gap-2 rounded-xl bg-paper/70 px-2.5 py-1.5">
      <span className="flex items-center gap-2 text-xs">
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: `hsl(${hue} 65% 42%)` }}
        />
        <span className={mine ? "font-semibold text-ink" : "text-ink/70"}>
          {mine ? (lang === "zh" ? "你" : "You") : name}
        </span>
      </span>

      {mine ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAdjust(entry, Math.max(0, entry.qty - 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-ink/15 bg-white text-base font-semibold active:scale-95"
            aria-label="-1"
          >
            −
          </button>
          <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums">
            {entry.qty}
          </span>
          <button
            type="button"
            onClick={() => onAdjust(entry, entry.qty + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-ink/15 bg-white text-base font-semibold active:scale-95"
            aria-label="+1"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => onRemove(entry)}
            className="ml-1 text-[11px] font-medium text-rose-600 hover:underline"
          >
            {t("remove", lang)}
          </button>
        </div>
      ) : (
        <span className="text-sm font-semibold tabular-nums text-ink/70">
          ×{entry.qty}
        </span>
      )}
    </li>
  );
}

