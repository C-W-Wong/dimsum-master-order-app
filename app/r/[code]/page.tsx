"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { LangToggle } from "@/components/LangToggle";
import { CategoryTabs } from "@/components/CategoryTabs";
import { MenuItemCard } from "@/components/MenuItemCard";
import { ParticipantChip } from "@/components/ParticipantChip";
import { BasketSheet } from "@/components/BasketSheet";
import { DuplicateConfirm } from "@/components/DuplicateConfirm";

import type { MenuItem } from "@/lib/menu";
import { priceFor } from "@/lib/menu";
import { fmtMoney, t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";
import { useRoom } from "@/lib/useRoom";
import {
  clearUserId,
  readName,
  readUserId,
  writeName,
  writeUserId,
} from "@/lib/identity";
import { ordersByItem, type OrderEntry, type Room } from "@/lib/room";

export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toString().toUpperCase();

  const [lang, , toggleLang] = useLang();
  const { room, loading, error, applyServerRoom } = useRoom(code);

  const [meId, setMeId] = useState<string>("");
  const [needsName, setNeedsName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!code || !room || meId) return;
    const stored = readUserId(code);
    if (stored && room.participants.some((p) => p.id === stored)) {
      setMeId(stored);
      setNeedsName(false);
      return;
    }
    const cachedName = readName();
    if (!cachedName) {
      setNeedsName(true);
      return;
    }
    joinRoom(cachedName);
  }, [code, !!room]); // eslint-disable-line react-hooks/exhaustive-deps

  async function joinRoom(name: string) {
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/room/${encodeURIComponent(code)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userName: name }),
      });
      if (res.status === 404) {
        setJoinError(t("roomNotFound", lang));
        return;
      }
      if (!res.ok) throw new Error("join-failed");
      const data = (await res.json()) as {
        room: Room;
        you: { userId: string };
      };
      writeName(name);
      writeUserId(code, data.you.userId);
      setMeId(data.you.userId);
      setNeedsName(false);
      applyServerRoom(data.room);
    } catch {
      setJoinError(t("syncError", lang));
    } finally {
      setJoining(false);
    }
  }

  if (error === "not-found") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold">{t("roomNotFound", lang)}</p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white"
        >
          {lang === "zh" ? "回首頁" : "Back home"}
        </button>
      </main>
    );
  }

  if (loading || !room) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center text-sm text-ink/50">
        {t("loading", lang)}
      </main>
    );
  }

  if (needsName) {
    return (
      <NameGate
        lang={lang}
        toggleLang={toggleLang}
        code={code}
        joining={joining}
        joinError={joinError}
        defaultName={nameInput}
        onChange={setNameInput}
        onSubmit={(name) => joinRoom(name)}
      />
    );
  }

  return (
    <RoomView
      room={room}
      meId={meId}
      lang={lang}
      toggleLang={toggleLang}
      code={code}
      applyServerRoom={applyServerRoom}
      onLeave={() => {
        clearUserId(code);
        router.push("/");
      }}
    />
  );
}

function NameGate({
  lang,
  toggleLang,
  code,
  joining,
  joinError,
  defaultName,
  onChange,
  onSubmit,
}: {
  lang: ReturnType<typeof useLang>[0];
  toggleLang: ReturnType<typeof useLang>[2];
  code: string;
  joining: boolean;
  joinError: string | null;
  defaultName: string;
  onChange: (n: string) => void;
  onSubmit: (name: string) => void;
}) {
  return (
    <main className="safe-top mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-6">
      <header className="flex items-center justify-between">
        <div className="text-sm font-medium text-ink/60">
          {lang === "zh" ? "加入房間" : "Join room"}
          <span className="ml-2 rounded-md bg-ink/5 px-2 py-0.5 font-mono text-base tracking-[0.3em] text-ink">
            {code}
          </span>
        </div>
        <LangToggle lang={lang} onToggle={toggleLang} />
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = defaultName.trim();
          if (!trimmed) return;
          onSubmit(trimmed);
        }}
        className="mt-10 rounded-2xl border border-ink/10 bg-white p-5 shadow-card"
      >
        <label className="block text-xs font-medium uppercase tracking-wide text-ink/60">
          {t("yourName", lang)}
        </label>
        <input
          type="text"
          value={defaultName}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("yourNamePlaceholder", lang)}
          maxLength={24}
          autoFocus
          className="mt-2 w-full rounded-xl border border-ink/15 bg-paper px-4 py-3 text-base outline-none focus:border-accent focus:bg-white"
          disabled={joining}
        />
        <button
          type="submit"
          disabled={joining || !defaultName.trim()}
          className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-accent text-base font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60"
        >
          {joining ? t("loading", lang) : t("join", lang)}
        </button>
        {joinError && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {joinError}
          </p>
        )}
      </form>
    </main>
  );
}

/* ─────────────────────────────  Room view  ───────────────────────────── */

function RoomView({
  room,
  meId,
  lang,
  toggleLang,
  code,
  applyServerRoom,
  onLeave,
}: {
  room: Room;
  meId: string;
  lang: ReturnType<typeof useLang>[0];
  toggleLang: ReturnType<typeof useLang>[2];
  code: string;
  applyServerRoom: (r: Room) => void;
  onLeave: () => void;
}) {
  const { categories, items: allItems, restaurant } = room.menu;

  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [hideOrdered, setHideOrdered] = useState(false);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [basketOpen, setBasketOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingDup, setPendingDup] = useState<{
    item: MenuItem;
    names: string[];
  } | null>(null);

  const entriesByItem = useMemo(() => ordersByItem(room.orders), [room.orders]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((item) => {
      if (activeCat !== "all" && item.category !== activeCat) return false;
      if (q) {
        const blob = `${item.code ?? ""} ${item.zh} ${item.en}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (hideOrdered) {
        const entries = entriesByItem.get(item.id);
        if (entries && entries.length > 0) return false;
      }
      return true;
    });
  }, [allItems, activeCat, search, hideOrdered, entriesByItem]);

  const sections = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of filteredItems) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return categories
      .filter((c) => map.has(c.id))
      .map((c) => ({ cat: c, items: map.get(c.id) ?? [] }));
  }, [filteredItems, categories]);

  const totalCount = room.orders.reduce((s, o) => s + o.qty, 0);
  const totalAmount = room.orders.reduce((s, o) => {
    const item = allItems.find((m) => m.id === o.itemId);
    return s + (item ? priceFor(item, categories) * o.qty : 0);
  }, 0);

  async function addItem(itemId: string, force = false) {
    const item = allItems.find((m) => m.id === itemId);
    if (!item) return;

    if (!force) {
      const others = (entriesByItem.get(itemId) ?? [])
        .filter((e) => e.userId !== meId)
        .map((e) => e.userName);
      const uniqueOthers = Array.from(new Set(others));
      if (uniqueOthers.length > 0) {
        setPendingDup({ item, names: uniqueOthers });
        return;
      }
    }

    setBusyItem(itemId);
    try {
      const res = await fetch(`/api/room/${encodeURIComponent(code)}/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId, userId: meId, qty: 1 }),
      });
      if (!res.ok) throw new Error("add-failed");
      const data = (await res.json()) as { room: Room };
      applyServerRoom(data.room);
    } catch {
      /* polling will rectify */
    } finally {
      setBusyItem(null);
    }
  }

  async function adjustEntry(entry: OrderEntry, qty: number) {
    try {
      const res = await fetch(
        `/api/room/${encodeURIComponent(code)}/orders/${entry.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: meId, qty }),
        }
      );
      if (!res.ok) throw new Error("patch-failed");
      const data = (await res.json()) as { room: Room };
      applyServerRoom(data.room);
    } catch {
      /* polling will recover */
    }
  }

  async function removeEntry(entry: OrderEntry) {
    try {
      const res = await fetch(
        `/api/room/${encodeURIComponent(code)}/orders/${entry.id}?userId=${encodeURIComponent(meId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("del-failed");
      const data = (await res.json()) as { room: Room };
      applyServerRoom(data.room);
    } catch {
      /* polling will recover */
    }
  }

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const restName = lang === "zh" ? restaurant.zh : restaurant.en;
    const text =
      (lang === "zh"
        ? `一起點 ${restName} 的菜！房間代碼 `
        : `Join our order at ${restName} — room code `) + code;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: t("appName", lang), text, url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  const expiresInLabel = useMemo(() => {
    const ms = room.expiresAt - Date.now();
    if (ms <= 0) return "—";
    const totalMin = Math.floor(ms / 60_000);
    if (totalMin >= 60) {
      return `${Math.floor(totalMin / 60)}${t("hours", lang)}`;
    }
    return `${totalMin}${t("minutes", lang)}`;
  }, [room.expiresAt, lang]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-paper pb-32">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/95 backdrop-blur safe-top">
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <button
            type="button"
            onClick={onLeave}
            className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-ink/60 active:bg-ink/5"
            aria-label={t("leave", lang)}
          >
            <span aria-hidden>←</span>
            <span>{t("leave", lang)}</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={share}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-ink px-3.5 text-sm font-semibold text-white active:scale-95"
            >
              <ShareIcon />
              {copied ? t("copied", lang) : t("share", lang)}
            </button>
            <LangToggle lang={lang} onToggle={toggleLang} />
          </div>
        </div>

        <div className="flex items-end justify-between gap-3 px-4 pb-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-tight">
              {lang === "zh" ? restaurant.zh : restaurant.en}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink/40">
              {t("roomCode", lang)}
            </p>
            <p className="font-mono text-2xl font-bold leading-none tracking-[0.35em] text-ink">
              {code}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-ink/40">
              {t("expiresIn", lang, { n: expiresInLabel })}
            </p>
            <div className="mt-1 flex max-w-[10rem] flex-wrap justify-end gap-1.5">
              {room.participants.map((p) => (
                <ParticipantChip
                  key={p.id}
                  p={p}
                  size="sm"
                  showName={false}
                  highlight={p.id === meId}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 pb-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search", lang)}
            className="w-full rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>

        <CategoryTabs
          categories={categories}
          active={activeCat}
          onSelect={setActiveCat}
          lang={lang}
        />

        <div className="flex items-center justify-between px-4 py-2 text-[12px] text-ink/60">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={hideOrdered}
              onChange={(e) => setHideOrdered(e.target.checked)}
              className="h-4 w-4 rounded border-ink/30"
            />
            {t("hideOrdered", lang)}
          </label>
          <span className="tabular-nums">
            {filteredItems.length} {lang === "zh" ? "項" : "items"}
          </span>
        </div>
      </header>

      {/* ─── Menu list ─── */}
      <div className="px-4 pt-3">
        {sections.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink/15 bg-white p-6 text-center text-sm text-ink/50">
            {t("noResults", lang)}
          </p>
        ) : (
          sections.map(({ cat, items }) => (
            <section key={cat.id} className="mb-6">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-base font-semibold">
                  {lang === "zh" ? cat.zh : cat.en}
                </h2>
                <div className="flex items-baseline gap-2 text-[11px] text-ink/50">
                  {cat.flatPrice && (
                    <span className="rounded-md bg-ink/5 px-1.5 py-0.5 font-semibold tabular-nums text-ink/70">
                      {fmtMoney(cat.flatPrice, lang)}
                    </span>
                  )}
                  {(cat.noteZh || cat.noteEn) && (
                    <span>{lang === "zh" ? cat.noteZh : cat.noteEn}</span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    categories={categories}
                    lang={lang}
                    entries={entriesByItem.get(item.id) ?? []}
                    meId={meId}
                    participants={room.participants}
                    onAdd={() => addItem(item.id)}
                    busy={busyItem === item.id}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <BasketBar
        count={totalCount}
        amount={totalAmount}
        lang={lang}
        onOpen={() => setBasketOpen(true)}
      />

      <BasketSheet
        open={basketOpen}
        onClose={() => setBasketOpen(false)}
        room={room}
        meId={meId}
        lang={lang}
        onAdjust={adjustEntry}
        onRemove={removeEntry}
      />

      {pendingDup && (
        <DuplicateConfirm
          item={pendingDup.item}
          otherNames={pendingDup.names}
          lang={lang}
          onCancel={() => setPendingDup(null)}
          onConfirm={() => {
            const id = pendingDup.item.id;
            setPendingDup(null);
            addItem(id, true);
          }}
        />
      )}
    </main>
  );
}

function BasketBar({
  count,
  amount,
  lang,
  onOpen,
}: {
  count: number;
  amount: number;
  lang: ReturnType<typeof useLang>[0];
  onOpen: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-3 pb-3 safe-bottom">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lg transition active:scale-[0.98]"
      >
        <span className="flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-base">
            <BasketIcon />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold ring-2 ring-ink">
                {count}
              </span>
            )}
          </span>
          <span className="text-left">
            <span className="block text-[11px] uppercase tracking-wider text-white/60">
              {t("basket", lang)}
            </span>
            <span className="block text-sm font-semibold">
              {t("totalItems", lang, { n: count })}
            </span>
          </span>
        </span>
        <span className="text-right">
          <span className="block text-[11px] uppercase tracking-wider text-white/60">
            {t("subtotal", lang)}
          </span>
          <span className="block text-base font-bold tabular-nums">
            {fmtMoney(amount, lang)}
          </span>
        </span>
      </button>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function BasketIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7h18l-1.4 11.2A2 2 0 0 1 17.6 20H6.4a2 2 0 0 1-2-1.8L3 7Z" />
      <path d="M8 7V5a4 4 0 1 1 8 0v2" />
    </svg>
  );
}
