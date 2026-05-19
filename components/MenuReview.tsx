"use client";

import { useMemo, useState } from "react";
import type { Category, MenuItem, ParsedMenu } from "@/lib/menu";
import type { Lang } from "@/lib/i18n";
import { fmtMoney } from "@/lib/i18n";

type Props = {
  menu: ParsedMenu;
  onChange: (next: ParsedMenu) => void;
  lang: Lang;
};

/**
 * Editable review of the parsed menu. Inline-edit names and prices, delete
 * items, delete categories (cascades to their items). Adding new items is
 * intentionally out of scope for v1 — re-shooting the photo is usually faster
 * than building 8 fields by hand.
 */
export function MenuReview({ menu, onChange, lang }: Props) {
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<string | null>(null);

  const itemsByCat = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of menu.items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [menu.items]);

  function updateRestaurant(patch: Partial<ParsedMenu["restaurant"]>) {
    onChange({ ...menu, restaurant: { ...menu.restaurant, ...patch } });
  }

  function updateCategory(id: string, patch: Partial<Category>) {
    onChange({
      ...menu,
      categories: menu.categories.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      ),
    });
  }

  function removeCategory(id: string) {
    onChange({
      ...menu,
      categories: menu.categories.filter((c) => c.id !== id),
      items: menu.items.filter((i) => i.category !== id),
    });
  }

  function updateItem(id: string, patch: Partial<MenuItem>) {
    onChange({
      ...menu,
      items: menu.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    });
  }

  function removeItem(id: string) {
    onChange({ ...menu, items: menu.items.filter((i) => i.id !== id) });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-card">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink/50">
          {lang === "zh" ? "餐廳" : "Restaurant"}
        </h3>
        <div className="mt-2 grid gap-2">
          <Field
            label={lang === "zh" ? "中文名稱" : "Chinese name"}
            value={menu.restaurant.zh}
            onChange={(v) => updateRestaurant({ zh: v })}
          />
          <Field
            label={lang === "zh" ? "英文名稱" : "English name"}
            value={menu.restaurant.en}
            onChange={(v) => updateRestaurant({ en: v })}
          />
        </div>
      </section>

      {menu.categories.map((cat) => {
        const items = itemsByCat.get(cat.id) ?? [];
        const editing = editingCat === cat.id;
        return (
          <section
            key={cat.id}
            className="rounded-2xl border border-ink/10 bg-white shadow-card"
          >
            <header className="flex items-start justify-between gap-2 border-b border-ink/5 px-4 py-3">
              <button
                type="button"
                onClick={() => setEditingCat(editing ? null : cat.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-[15px] font-semibold leading-tight">
                  {lang === "zh" ? cat.zh : cat.en}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-ink/50">
                  {lang === "zh" ? cat.en : cat.zh}
                  {cat.flatPrice ? (
                    <span className="ml-2 rounded bg-ink/5 px-1.5 py-0.5 text-[11px] font-semibold text-ink/70 tabular-nums">
                      {fmtMoney(cat.flatPrice, lang)}
                    </span>
                  ) : null}
                  <span className="ml-2 text-ink/40">
                    · {items.length} {lang === "zh" ? "項" : "items"}
                  </span>
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(lang === "zh" ? "刪除整個分類？" : "Delete this category?")) {
                    removeCategory(cat.id);
                  }
                }}
                className="shrink-0 rounded-full p-1.5 text-ink/30 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Delete category"
              >
                <TrashIcon />
              </button>
            </header>

            {editing && (
              <div className="grid gap-2 border-b border-ink/5 bg-paper/50 px-4 py-3">
                <Field
                  label={lang === "zh" ? "中文名稱" : "Chinese name"}
                  value={cat.zh}
                  onChange={(v) => updateCategory(cat.id, { zh: v })}
                />
                <Field
                  label={lang === "zh" ? "英文名稱" : "English name"}
                  value={cat.en}
                  onChange={(v) => updateCategory(cat.id, { en: v })}
                />
                <Field
                  type="number"
                  label={lang === "zh" ? "分類統一價（可留空）" : "Flat price (optional)"}
                  value={cat.flatPrice ?? ""}
                  onChange={(v) =>
                    updateCategory(cat.id, {
                      flatPrice: v === "" ? undefined : Number(v),
                    })
                  }
                />
              </div>
            )}

            <ul className="divide-y divide-ink/5">
              {items.map((item) => {
                const isEditing = editingItem === item.id;
                return (
                  <li key={item.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingItem(isEditing ? null : item.id)
                        }
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-[14px] font-medium leading-tight">
                          {item.code && (
                            <span className="mr-1.5 text-[10px] font-bold tracking-wider text-ink/40">
                              {item.code}
                            </span>
                          )}
                          {lang === "zh" ? item.zh : item.en}
                          {item.price !== undefined && (
                            <span className="ml-2 text-[11px] tabular-nums text-ink/60">
                              {fmtMoney(item.price, lang)}
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[11px] text-ink/50">
                          {lang === "zh" ? item.en : item.zh}
                          {(item.unitZh || item.unitEn) && (
                            <span className="ml-1 text-ink/40">
                              · {lang === "zh" ? item.unitZh ?? item.unitEn : item.unitEn ?? item.unitZh}
                            </span>
                          )}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="shrink-0 rounded-full p-1.5 text-ink/30 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Remove item"
                      >
                        <TrashIcon />
                      </button>
                    </div>

                    {isEditing && (
                      <div className="mt-2 grid gap-2 rounded-xl bg-paper/60 p-3">
                        <Field
                          label={lang === "zh" ? "中文" : "Chinese"}
                          value={item.zh}
                          onChange={(v) => updateItem(item.id, { zh: v })}
                        />
                        <Field
                          label={lang === "zh" ? "英文" : "English"}
                          value={item.en}
                          onChange={(v) => updateItem(item.id, { en: v })}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Field
                            label={lang === "zh" ? "編號" : "Code"}
                            value={item.code ?? ""}
                            onChange={(v) =>
                              updateItem(item.id, { code: v || undefined })
                            }
                          />
                          <Field
                            type="number"
                            label={lang === "zh" ? "價格（可空）" : "Price (opt)"}
                            value={item.price ?? ""}
                            onChange={(v) =>
                              updateItem(item.id, {
                                price: v === "" ? undefined : Number(v),
                              })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-medium uppercase tracking-wider text-ink/50">
        {label}
      </span>
      <input
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
