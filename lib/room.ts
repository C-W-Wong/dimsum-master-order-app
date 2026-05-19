import type { ParsedMenu } from "./menu";
import { getRedis } from "./redis";

export type Participant = {
  id: string;
  name: string;
  /** Color hue (0-360) used for the chip / avatar. */
  hue: number;
  joinedAt: number;
};

export type OrderEntry = {
  /** Stable id used by the client to remove or adjust. */
  id: string;
  /** MenuItem.id within room.menu */
  itemId: string;
  /** Quantity (positive integer). */
  qty: number;
  /** Participant id who added this entry. */
  userId: string;
  /** Snapshot of the participant's name at add-time. */
  userName: string;
  /** Optional free-form note. Currently unused in UI. */
  note?: string;
  createdAt: number;
};

export type Room = {
  code: string;
  createdAt: number;
  expiresAt: number;
  /** The menu parsed from the host's photo(s). Per-room, never shared. */
  menu: ParsedMenu;
  participants: Participant[];
  orders: OrderEntry[];
  /** Bumped on every write so clients can diff cheaply. */
  version: number;
};

const ROOM_TTL_SECONDS = 60 * 60 * 24; // 24h
const KEY = (code: string) => `room:${code.toUpperCase()}`;

// Avoid 0/O and 1/I/L confusion in the room code.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(len = 4): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

export function isValidCode(code: string): boolean {
  return /^[A-Z2-9]{4,6}$/i.test(code);
}

export function newRoom(code: string, menu: ParsedMenu): Room {
  const now = Date.now();
  return {
    code: code.toUpperCase(),
    createdAt: now,
    expiresAt: now + ROOM_TTL_SECONDS * 1000,
    menu,
    participants: [],
    orders: [],
    version: 1,
  };
}

export async function readRoom(code: string): Promise<Room | null> {
  const redis = getRedis();
  const raw = await redis.get<Room | string>(KEY(code));
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as Room) : raw;
}

export async function writeRoom(room: Room): Promise<void> {
  const redis = getRedis();
  const ttl = Math.max(60, Math.floor((room.expiresAt - Date.now()) / 1000));
  await redis.set(KEY(room.code), JSON.stringify(room), { ex: ttl });
}

export async function updateRoom(
  code: string,
  mutate: (room: Room) => void | Room
): Promise<Room | null> {
  const room = await readRoom(code);
  if (!room) return null;
  const next = mutate(room) ?? room;
  next.version = (room.version ?? 0) + 1;
  await writeRoom(next);
  return next;
}

export function pickHue(existing: Participant[]): number {
  if (existing.length === 0) return Math.floor(Math.random() * 360);
  const base = existing[existing.length - 1].hue;
  return Math.floor((base + 137) % 360);
}

export function newId(prefix = ""): string {
  const r = Math.random().toString(36).slice(2, 8);
  const t = Date.now().toString(36).slice(-4);
  return `${prefix}${t}${r}`;
}

/** Group order entries by menu item id, preserving insertion order. */
export function ordersByItem(orders: OrderEntry[]): Map<string, OrderEntry[]> {
  const map = new Map<string, OrderEntry[]>();
  for (const o of orders) {
    const list = map.get(o.itemId);
    if (list) list.push(o);
    else map.set(o.itemId, [o]);
  }
  return map;
}
