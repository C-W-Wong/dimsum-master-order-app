"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { compressImage, type CompressedImage } from "@/lib/compressImage";

const MAX_PHOTOS = 4;

export type StagedPhoto = CompressedImage & { id: string };

export function MenuPhotoUpload({
  photos,
  onChange,
  lang,
  disabled,
}: {
  photos: StagedPhoto[];
  onChange: (next: StagedPhoto[]) => void;
  lang: Lang;
  disabled?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoke object URLs on unmount to avoid leaks.
  useEffect(() => {
    return () => {
      for (const p of photos) URL.revokeObjectURL(p.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);

    const slotsLeft = MAX_PHOTOS - photos.length;
    const incoming = Array.from(files).slice(0, slotsLeft);
    if (files.length > slotsLeft) {
      setError(
        lang === "zh"
          ? `最多 ${MAX_PHOTOS} 張，已忽略多餘的照片。`
          : `Only ${MAX_PHOTOS} photos max — extras ignored.`
      );
    }

    try {
      const compressed: StagedPhoto[] = [];
      for (const f of incoming) {
        const c = await compressImage(f);
        compressed.push({ ...c, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
      }
      onChange([...photos, ...compressed]);
    } catch (err) {
      setError(
        (lang === "zh" ? "無法讀取相片：" : "Couldn't read photo: ") +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function removeAt(idx: number) {
    const removed = photos[idx];
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    onChange(photos.filter((_, i) => i !== idx));
  }

  const canAddMore = photos.length < MAX_PHOTOS;

  return (
    <div className="space-y-3">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled || busy}
      />

      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={disabled || busy}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/20 bg-white py-10 text-ink/60 transition active:scale-[0.98] disabled:opacity-50"
        >
          <CameraIcon />
          <span className="text-sm font-semibold">
            {busy
              ? lang === "zh"
                ? "處理中…"
                : "Processing…"
              : lang === "zh"
                ? "拍照／選相片"
                : "Take or pick photo"}
          </span>
          <span className="text-[11px] text-ink/40">
            {lang === "zh"
              ? `可一次選擇多張（最多 ${MAX_PHOTOS} 張）`
              : `Up to ${MAX_PHOTOS} photos`}
          </span>
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((p, idx) => (
            <figure
              key={p.id}
              className="relative overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt={`Menu photo ${idx + 1}`}
                className="aspect-[3/4] w-full object-cover"
              />
              <figcaption className="flex items-center justify-between px-2 py-1 text-[10px] text-ink/50">
                <span>{(p.bytes / 1024).toFixed(0)} KB</span>
                <span>
                  {p.width}×{p.height}
                </span>
              </figcaption>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                disabled={disabled || busy}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-white backdrop-blur-sm transition active:scale-90"
                aria-label="Remove"
              >
                ×
              </button>
            </figure>
          ))}

          {canAddMore && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={disabled || busy}
              className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-ink/20 bg-white text-ink/50 transition active:scale-95 disabled:opacity-50"
            >
              <PlusIcon />
              <span className="text-xs font-semibold">
                {busy
                  ? lang === "zh"
                    ? "處理中…"
                    : "Processing…"
                  : lang === "zh"
                    ? "再加一張"
                    : "Add another"}
              </span>
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      )}
    </div>
  );
}

export function CameraIcon({ size = 32 }: { size?: number } = {}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={size > 24 ? 1.6 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
