"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LangToggle } from "@/components/LangToggle";
import { CameraIcon } from "@/components/MenuPhotoUpload";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";
import { readName, writeName, writeUserId } from "@/lib/identity";

export default function HomePage() {
  const router = useRouter();
  const [lang, , toggleLang] = useLang();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(readName());
  }, []);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim()) writeName(name.trim());
    router.push("/new");
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedName) {
      setError(t("needName", lang));
      return;
    }
    if (!trimmedCode) {
      setError(t("needCode", lang));
      return;
    }
    setJoining(true);
    writeName(trimmedName);
    try {
      const res = await fetch(`/api/room/${encodeURIComponent(trimmedCode)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userName: trimmedName }),
      });
      if (res.status === 404) {
        setError(t("roomNotFound", lang));
        setJoining(false);
        return;
      }
      if (!res.ok) throw new Error("join-failed");
      const data = (await res.json()) as {
        room: { code: string };
        you: { userId: string };
      };
      writeUserId(data.room.code, data.you.userId);
      router.push(`/r/${data.room.code}`);
    } catch {
      setError(t("syncError", lang));
      setJoining(false);
    }
  }

  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tracking-tight">
            <span className="text-accent">點</span>
            <span className="text-accent">餐</span>
            <span className="ml-1.5">·</span>
            <span className="ml-1.5 text-ink">Group Order</span>
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/50">
            Snap → Parse → Share
          </p>
        </div>
        <LangToggle lang={lang} onToggle={toggleLang} />
      </header>

      <section className="mt-10">
        <h1 className="text-[28px] font-semibold leading-tight">
          {t("appName", lang)}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink/70">
          {t("newTagline", lang)}
        </p>
      </section>

      <form
        onSubmit={handleCreate}
        className="mt-8 rounded-2xl border border-ink/10 bg-white p-5 shadow-card"
      >
        <label className="block text-xs font-medium uppercase tracking-wide text-ink/60">
          {t("yourName", lang)}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("yourNamePlaceholder", lang)}
          maxLength={24}
          autoComplete="nickname"
          autoCapitalize="words"
          className="mt-2 w-full rounded-xl border border-ink/15 bg-paper px-4 py-3 text-base outline-none transition focus:border-accent focus:bg-white"
        />
        <button
          type="submit"
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-base font-semibold text-white shadow-sm transition active:scale-[0.98]"
        >
          <CameraIcon size={18} />
          {t("createRoom", lang)}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-ink/40">
        <div className="h-px flex-1 bg-ink/10" />
        <span>{t("orJoinExisting", lang)}</span>
        <div className="h-px flex-1 bg-ink/10" />
      </div>

      <form
        onSubmit={handleJoin}
        className="rounded-2xl border border-ink/10 bg-white p-5 shadow-card"
      >
        <label className="block text-xs font-medium uppercase tracking-wide text-ink/60">
          {t("roomCode", lang)}
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/[^A-Za-z2-9]/g, "").toUpperCase())
          }
          placeholder={t("roomCodePlaceholder", lang)}
          maxLength={6}
          autoCapitalize="characters"
          inputMode="text"
          className="mt-2 w-full rounded-xl border border-ink/15 bg-paper px-4 py-3 text-center text-2xl font-semibold tracking-[0.4em] uppercase outline-none transition focus:border-accent focus:bg-white"
          disabled={joining}
        />
        <button
          type="submit"
          disabled={joining}
          className="mt-4 flex h-12 w-full items-center justify-center rounded-xl border border-ink/15 bg-paper text-base font-semibold text-ink shadow-sm transition active:scale-[0.98] disabled:opacity-60"
        >
          {joining ? t("loading", lang) : t("join", lang)}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      <footer className="mt-auto pt-10 text-center text-[11px] text-ink/40">
        {lang === "zh"
          ? "拍菜單，揪朋友一起點餐。"
          : "Snap any menu, order together."}
      </footer>
    </main>
  );
}

