# Snap-Menu Group Order · 拍菜單揪團點餐

A mobile-first **group ordering** web app for any restaurant. Snap the menu, AI parses it, share the room code, and your table orders together — in 中文 / English.

- 📸 **Snap any menu** — take 1–4 photos and Claude vision turns them into a structured menu with categories, prices, and bilingual names.
- ✍️ **Quick review** — fix any names or prices the model misread *before* opening the room.
- 👯 **Group rooms** — everyone in the room sees everyone's picks in real time, so you don't double-order the 蝦餃.
- 🇭🇰 / 🇺🇸 **Bilingual** — every dish, button, and confirmation in both Traditional Chinese and English. Toggle anywhere with one tap.
- 📱 **Mobile-first** — designed for one-thumb use at the table. Big tap targets, sticky basket, bottom sheet.
- ⏱ **Auto-expiring rooms** — rooms vanish 24 h after the last write, so storage stays clean.

Built with Next.js 14 (App Router), React 18, Tailwind CSS, the Claude API (`@anthropic-ai/sdk`), and Upstash Redis.

---

## Quick start (local dev)

```bash
npm install
cp .env.example .env.local        # fill in two services (see below)
npm run dev                       # → http://localhost:3000
```

### 1. Anthropic API key (required for menu parsing)

`/api/parse-menu` calls `claude-sonnet-4-6` with vision and prompt caching.

1. Sign in at <https://console.anthropic.com> → **Settings → API Keys** → **Create**.
2. Paste into `.env.local`:
   ```env
   ANTHROPIC_API_KEY="sk-ant-..."
   ```

> **Cost note.** A typical menu parse uses ~5K–15K input tokens (mostly the images) + ~2K output tokens. With Sonnet 4.6 at $3 / $15 per million, each parse runs ~$0.05–0.10. The static system prompt is marked `cache_control: ephemeral`, so repeat parses within 5 minutes only pay ~$0.005 on the prompt portion.

### 2. Upstash Redis (group-order state)

Two ways to provision; either works:

**Option A — through Vercel (recommended).**
1. <https://vercel.com/dashboard> → **Storage** → **Create Database** → **Upstash Redis (Marketplace)**.
2. Link to your project. Vercel injects `KV_REST_API_URL` + `KV_REST_API_TOKEN` automatically.

**Option B — direct from Upstash.**
1. <https://console.upstash.com> → **Create Database** (Global region works fine).
2. Copy REST URL + Token into `.env.local`:
   ```env
   KV_REST_API_URL="https://us1-xxxx.upstash.io"
   KV_REST_API_TOKEN="AXxxxxxxxxxxxxxxxx"
   ```
   The app also accepts `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

---

## Deploy to Vercel

```bash
npx vercel             # first time: log in + link a new project
npx vercel --prod      # ship it
```

…or click **New Project** in the Vercel dashboard:

1. Point at this repo. Build settings stay default (Vercel auto-detects Next.js).
2. **Storage** tab → **Add Upstash Redis** → click "Connect Project" (sets `KV_REST_API_*`).
3. **Settings → Environment Variables** → add `ANTHROPIC_API_KEY`.
4. Click **Deploy**.

That's it.

---

## How a session works

| Step | Who | What |
| --- | --- | --- |
| 1 | Host | Opens app → **Create new room** → goes to **Photograph the menu**. |
| 2 | Host | Takes 1–4 photos (front, back, multi-page is fine), enters a name, taps **Parse menu with AI**. |
| 3 | App | Compresses photos client-side (~1600 px JPEGs) and sends to `/api/parse-menu`. Server calls Claude with a cached system prompt and a structured `submit_menu` tool. |
| 4 | Host | Reviews the parsed menu — taps any item or category to edit names / prices / codes, trash icon to delete misreads. |
| 5 | Host | Taps **Open room** → gets a 4-letter code (e.g. `KQ7M`) and a shareable URL. |
| 6 | Friends | Open the link, enter a name, tap **Join**. |
| 7 | Anyone | Browses the menu, taps **Add** on items. If someone else already added it, the button turns amber and a confirm sheet asks *"Alex already added this — add another?"* |
| 8 | Anyone | Opens the bottom basket to see all picks grouped by item, with each member's contributions. You can `−` / `＋` / Remove **your own** entries. |

State sync is **polling at 2.5 s** — when the tab is hidden, polling stops to save Upstash quota.

---

## Project structure

```
app/
  layout.tsx                Root layout, viewport, theme color
  page.tsx                  Home (Create / Join)
  globals.css               Tailwind + safe-area helpers
  new/page.tsx              Photo upload → parse → review → open room
  r/[code]/page.tsx         The room: menu, basket, share, sync
  api/
    parse-menu/route.ts                      POST → Claude vision parse
    room/route.ts                            POST → create room (takes menu)
    room/[code]/route.ts                     GET → fetch, POST → join
    room/[code]/orders/route.ts              POST → add an entry
    room/[code]/orders/[orderId]/route.ts    PATCH / DELETE → adjust your own

components/
  MenuPhotoUpload.tsx     Camera/gallery picker, client-side compression, thumbnails
  MenuReview.tsx          Editable parsed menu (inline edit, delete, cascade)
  CategoryTabs.tsx        Horizontal sticky tab strip
  MenuItemCard.tsx        Single dish card (with "ordered by X" badges)
  BasketSheet.tsx         Bottom-sheet order list with per-person adjustments
  DuplicateConfirm.tsx    "Someone already added this" modal
  ParticipantChip.tsx     Coloured avatar chip
  LangToggle.tsx          中 / EN switcher

lib/
  parseMenu.ts            Claude API client (server-only): prompt + tool schema + validation
  compressImage.ts        Client-side canvas resize + JPEG re-encode → base64
  menu.ts                 Menu types and helpers (priceFor, findItem, …)
  i18n.ts                 String dictionary + helpers
  redis.ts                Lazy Upstash client
  room.ts                 Room storage helpers (Redis JSON + TTL)
  useRoom.ts              Polling hook for live state
  useLang.ts              Language toggle hook (persists to localStorage)
  identity.ts             Per-room user id + name persistence
```

---

## Customising the parser

`lib/parseMenu.ts` controls how Claude reads menus. The interesting knobs:

- **Model** — defaults to `claude-sonnet-4-6`. Bump to `claude-opus-4-7` for tricky multi-language menus (slower, ~5× cost). Edit the `model:` literal in `parseMenu()`.
- **Prompt caching** — the system prompt is large and static and uses `cache_control: { type: "ephemeral" }`. Don't interpolate per-request data (timestamps, room IDs) into it or the cache invalidates. See `shared/prompt-caching.md` in the Claude API skill for the audit checklist.
- **System prompt** — `SYSTEM_PROMPT` is where category/price-detection rules live. Tweak it for cuisines with quirky conventions (e.g. *cha-chaan teng* combos, *omakase* multi-course menus).
- **Schema** — `SUBMIT_MENU_TOOL.input_schema` is the source of truth for what a menu looks like. Adding a field here also requires updating the `ParsedMenu` type in `lib/menu.ts`.

If the parser hallucinates items that aren't on the menu, tighten the prompt with: *"Only include items that are clearly visible. If you're not sure a row is an item, skip it rather than guessing."*

---

## Tech notes

- **Storage model**: one Redis key per room (`room:ABCD`) — value is the entire room JSON (menu + participants + orders). 24 h TTL refreshed on every write. Simple, cheap, no migrations.
- **Identity**: each browser stores its own `userId` per room in `localStorage`. Rejoining with the same name reuses the slot; different browser → new participant.
- **No realtime websocket**: 2.5 s polling. Chosen for zero-infra deploy on Vercel + Upstash. Swap to Pusher / Upstash QStash if you need lower latency.
- **Permissioning**: a participant can only adjust / remove their **own** entries. Server enforces this in `PATCH` / `DELETE`.
- **Image pipeline**: client compresses to ≤1600 px / JPEG 0.85 → ~300-800 KB → base64 in POST body → Claude vision. Avoids Vercel's 4.5 MB body limit and reduces parse latency.

---

## License

MIT.
