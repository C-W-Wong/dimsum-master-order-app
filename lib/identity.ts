"use client";

const NAME_KEY = "dimsum:name";
const USER_PREFIX = "dimsum:user:"; // per-room user id, since the API issues a fresh one on join

export function readName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeName(name: string): void {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    /* noop */
  }
}

export function readUserId(roomCode: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(USER_PREFIX + roomCode.toUpperCase()) ?? "";
  } catch {
    return "";
  }
}

export function writeUserId(roomCode: string, userId: string): void {
  try {
    window.localStorage.setItem(USER_PREFIX + roomCode.toUpperCase(), userId);
  } catch {
    /* noop */
  }
}

export function clearUserId(roomCode: string): void {
  try {
    window.localStorage.removeItem(USER_PREFIX + roomCode.toUpperCase());
  } catch {
    /* noop */
  }
}
