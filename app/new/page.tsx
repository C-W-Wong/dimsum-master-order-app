"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { LangToggle } from "@/components/LangToggle";
import { MenuPhotoUpload, type StagedPhoto } from "@/components/MenuPhotoUpload";
import { MenuReview } from "@/components/MenuReview";

import { t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";
import { readName, writeName, writeUserId } from "@/lib/identity";
import type { ParsedMenu } from "@/lib/menu";

type Step = "upload" | "parsing" | "review";

export default function NewRoomPage() {
  const router = useRouter();
  const [lang, , toggleLang] = useLang();

  const [name, setName] = useState("");
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [step, setStep] = useState<Step>("upload");
  const [menu, setMenu] = useState<ParsedMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    setName(readName());
  }, []);

  async function handleParse() {
    if (photos.length === 0) {
      setError(t("needPhoto", lang));
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("needName", lang));
      return;
    }
    writeName(trimmed);
    setError(null);
    setStep("parsing");

    try {
      const res = await fetch("/api/parse-menu", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          images: photos.map((p) => ({ data: p.data, mediaType: p.mediaType })),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "parse-failed");
      }
      const { menu: parsed } = (await res.json()) as { menu: ParsedMenu };
      setMenu(parsed);
      setStep("review");
    } catch (err) {
      setError(
        (err instanceof Error && err.message) || t("parseFailed", lang)
      );
      setStep("upload");
    }
  }

  async function handleOpenRoom() {
    if (!menu) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("needName", lang));
      return;
    }
    setOpening(true);
    setError(null);
    try {
      const res = await fetch("/api/room", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userName: trimmed, menu }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "create-failed");
      }
      const data = (await res.json()) as {
        room: { code: string };
        you: { userId: string };
      };
      writeUserId(data.room.code, data.you.userId);
      router.push(`/r/${data.room.code}`);
    } catch (err) {
      setError(
        (err instanceof Error && err.message) || t("syncError", lang)
      );
      setOpening(false);
    }
  }

  const menuStats = useMemo(() => {
    if (!menu) return null;
    return { items: menu.items.length, cats: menu.categories.length };
  }, [menu]);

  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-6">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-ink/60 active:bg-ink/5"
        >
          <span aria-hidden>←</span>
          <span>{lang === "zh" ? "回首頁" : "Home"}</span>
        </button>
        <LangToggle lang={lang} onToggle={toggleLang} />
      </header>

      {/* ─── Step: upload ─── */}
      {step === "upload" && (
        <>
          <section className="mt-6">
            <h1 className="text-[26px] font-semibold leading-tight">
              {t("uploadHeading", lang)}
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-ink/60">
              {t("uploadSubhead", lang)}
            </p>
          </section>

          <div className="mt-5">
            <MenuPhotoUpload
              photos={photos}
              onChange={setPhotos}
              lang={lang}
            />
          </div>

          <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-4 shadow-card">
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
              className="mt-2 w-full rounded-xl border border-ink/15 bg-paper px-4 py-3 text-base outline-none focus:border-accent focus:bg-white"
            />
          </div>

          <button
            type="button"
            onClick={handleParse}
            disabled={photos.length === 0 || !name.trim()}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-base font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
          >
            <SparkleIcon />
            {t("parseMenu", lang)}
          </button>

          {error && (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {error}
            </p>
          )}
        </>
      )}

      {/* ─── Step: parsing ─── */}
      {step === "parsing" && (
        <section className="mt-16 flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center">
            <span className="block h-12 w-12 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
          </div>
          <p className="text-base font-semibold">{t("parsing", lang)}</p>
          <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-ink/50">
            {lang === "zh"
              ? "AI 正在逐項辨識菜單上的菜名與價格。"
              : "AI is reading the dish names and prices on your menu."}
          </p>
          <div className="mt-8 grid w-full grid-cols-4 gap-2">
            {photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.previewUrl}
                alt=""
                className="aspect-square w-full rounded-lg object-cover opacity-50"
              />
            ))}
          </div>
        </section>
      )}

      {/* ─── Step: review ─── */}
      {step === "review" && menu && (
        <>
          <section className="mt-6">
            <h1 className="text-[24px] font-semibold leading-tight">
              {t("reviewHeading", lang)}
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-ink/60">
              {t("reviewSubhead", lang)}
            </p>
            {menuStats && (
              <p className="mt-2 text-[12px] text-ink/40 tabular-nums">
                {t("categoriesCount", lang, { n: menuStats.cats })} ·{" "}
                {t("itemsCount", lang, { n: menuStats.items })}
              </p>
            )}
          </section>

          <div className="mt-4">
            <MenuReview menu={menu} onChange={setMenu} lang={lang} />
          </div>

          <div className="sticky bottom-0 -mx-5 mt-6 border-t border-ink/10 bg-paper/95 px-5 pt-3 pb-4 backdrop-blur safe-bottom">
            <button
              type="button"
              onClick={handleOpenRoom}
              disabled={opening || menu.items.length === 0}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-base font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            >
              {opening ? t("loading", lang) : t("openRoom", lang)}
            </button>
            <button
              type="button"
              onClick={() => {
                setMenu(null);
                setStep("upload");
              }}
              className="mt-2 flex h-10 w-full items-center justify-center text-sm font-medium text-ink/50 active:scale-95"
            >
              {t("reshoot", lang)}
            </button>
          </div>

          {error && (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {error}
            </p>
          )}
        </>
      )}
    </main>
  );
}

function SparkleIcon() {
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
      <path d="M12 3l1.7 4.7L18 9l-4.3 1.3L12 15l-1.7-4.7L6 9l4.3-1.3z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />
      <path d="M5 14l.5 1.5L7 16l-1.5.5L5 18l-.5-1.5L3 16l1.5-.5z" />
    </svg>
  );
}
