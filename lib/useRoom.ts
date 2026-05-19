"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "./room";

type RoomState = {
  room: Room | null;
  loading: boolean;
  error: "not-found" | "network" | null;
};

/**
 * Poll a room's state. Tab visibility halts polling so we don't waste
 * Upstash quota when the user has the screen in their pocket.
 *
 * Version guard: Room.version bumps on every server write. We only setState
 * when the response carries a strictly newer version — otherwise a quiet
 * room would re-render every poll tick even though nothing changed.
 */
export function useRoom(code: string, intervalMs = 2500) {
  const [state, setState] = useState<RoomState>({
    room: null,
    loading: true,
    error: null,
  });
  const inflight = useRef(false);
  const seenVersion = useRef(0);

  const fetchOnce = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch(`/api/room/${encodeURIComponent(code)}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        setState({ room: null, loading: false, error: "not-found" });
        return;
      }
      if (!res.ok) throw new Error("fetch-failed");
      const data = (await res.json()) as { room: Room };
      const v = data.room.version ?? 0;
      if (v > seenVersion.current) {
        seenVersion.current = v;
        setState({ room: data.room, loading: false, error: null });
      } else {
        // Same version → no change. Clear any prior network error.
        setState((prev) => (prev.error || prev.loading ? { ...prev, loading: false, error: null } : prev));
      }
    } catch {
      setState((prev) =>
        prev.room
          ? prev.error === "network" ? prev : { ...prev, error: "network" }
          : { room: null, loading: false, error: "network" }
      );
    } finally {
      inflight.current = false;
    }
  }, [code]);

  const applyServerRoom = useCallback((room: Room) => {
    const v = room.version ?? 0;
    if (v > seenVersion.current) {
      seenVersion.current = v;
      setState({ room, loading: false, error: null });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) {
        // Re-check when the tab becomes visible.
        return;
      }
      timer = setTimeout(async () => {
        await fetchOnce();
        schedule();
      }, intervalMs);
    };

    fetchOnce().then(schedule);

    const onVisible = () => {
      if (!document.hidden) {
        fetchOnce().then(schedule);
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchOnce, intervalMs]);

  return { ...state, refresh: fetchOnce, applyServerRoom };
}
