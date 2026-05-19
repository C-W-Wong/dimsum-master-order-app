/**
 * Menu schema. The actual menu is no longer hard-coded — it lives inside each
 * Room and is produced by the Claude-powered parser in lib/parseMenu.ts.
 * These types are the contract between parser, storage, and UI.
 */

export type MenuItem = {
  /** Stable id, unique within the menu. */
  id: string;
  /** Code printed on the menu (A1, B7, F12…). Optional. */
  code?: string;
  /** Category id this item belongs to. Must match one Category.id. */
  category: string;
  zh: string;
  en: string;
  /** Per-item price. If omitted, the category's flatPrice applies. */
  price?: number;
  /** Free-form unit hint ("4 pcs", "half", "per lb"). */
  unitZh?: string;
  unitEn?: string;
};

export type Category = {
  id: string;
  zh: string;
  en: string;
  /** Flat price applied to every item in the category, when set. */
  flatPrice?: number;
  noteZh?: string;
  noteEn?: string;
};

export type Restaurant = {
  zh: string;
  en: string;
  address?: string;
  phone?: string;
};

export type ParsedMenu = {
  restaurant: Restaurant;
  /** ISO 4217 code: "USD", "HKD", "TWD"… */
  currency: string;
  categories: Category[];
  items: MenuItem[];
};

const CATEGORY_PALETTE = [
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-sky-100 text-sky-800 border-sky-200",
  "bg-violet-100 text-violet-800 border-violet-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-pink-100 text-pink-800 border-pink-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-stone-100 text-stone-800 border-stone-200",
];

/** Deterministic colour for a category, indexed by its position in the menu. */
export function categoryAccent(index: number): string {
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}

export function priceFor(item: MenuItem, categories: Category[]): number {
  if (typeof item.price === "number") return item.price;
  const cat = categories.find((c) => c.id === item.category);
  return cat?.flatPrice ?? 0;
}

export function findItem(menu: ParsedMenu, itemId: string): MenuItem | undefined {
  return menu.items.find((m) => m.id === itemId);
}

export function findCategory(menu: ParsedMenu, categoryId: string): Category | undefined {
  return menu.categories.find((c) => c.id === categoryId);
}
