import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { ParsedMenu } from "./menu";

export type MenuImage = {
  /** Base64-encoded image bytes (no data: prefix). */
  data: string;
  /** Must be one of the Anthropic-supported types. */
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
};

/**
 * Pipeline:
 *   1. Each image → Haiku 4.5 vision OCR (parallel). Output is plain text.
 *   2. Combined OCR text → Haiku 4.5 text-only structuring via submit_menu tool.
 *
 * Fault tolerance:
 *   - Per-image OCR failures don't fail the parse; we use whatever succeeded.
 *   - Structuring auto-repairs common issues (dedup ids, drop orphan items)
 *     instead of throwing, so a near-miss menu still surfaces to the user.
 */

const OCR_SYSTEM_PROMPT = `You are an OCR engine for restaurant menus. Your ONLY job is to transcribe text from the photo verbatim.

Rules:
- Transcribe EVERY visible character: dish names (any language), prices, item codes (A1, B7, F12), category headers, notes, units (件, pcs, lb, oz, 隻, 半隻), currency symbols, taglines.
- Preserve the visual order — top-to-bottom, then left-to-right for multi-column menus.
- Keep Chinese characters as Chinese; Japanese as Japanese; etc. Do NOT translate.
- For each row, keep name and price on the same line. Separate with two spaces.
- Use a blank line between menu sections.
- If a character is unclear, transcribe your best guess — NEVER omit a row.
- Do NOT refuse. Do NOT return an empty response. Even partial transcription is valuable.
- Do NOT interpret, structure, JSON-ify, summarize, or comment. Output transcription only.`;

const STRUCTURE_SYSTEM_PROMPT = `You are a restaurant-menu structuring expert.

You receive OCR-transcribed text from one or more menu photos. The OCR is faithful but may have garbled characters, broken layout, duplicate fragments, or items split across lines. Your job: clean it up and call submit_menu with structured data.

# CRITICAL RULES — do not violate these

1. Call submit_menu EXACTLY ONCE. Do not write any other text.
2. items MUST contain at least one dish if there is any food-like text in the OCR. An empty items array is ALWAYS wrong — extract everything you can.
3. categories MUST contain at least one entry. If the OCR has no obvious section headers, create a single category called "menu" / "菜單".
4. Every item.category MUST exactly match a categories[].id you created. Double-check before emitting.
5. IDs are lower-snake-case slugs, UNIQUE within the menu. If two dishes have the same English name, suffix with -2, -3 etc.

# Required fields

- restaurant.zh — restaurant name in Traditional Chinese (translate if menu shows English only; if no name visible, use "餐廳").
- restaurant.en — restaurant name in English (translate if menu shows Chinese only; if no name visible, use "Restaurant").
- currency — ISO 4217 code: "USD" (default for US menus), "HKD", "TWD", "CNY", "CAD", "EUR", "JPY", "GBP".
- categories — every section visible in the OCR, in the order they appear.
- items — every visible dish. Be exhaustive.

# Field rules

- code: only set when a menu number is printed next to the item (A1, B7, C12, F19). Omit otherwise.
- price: numeric, in the menu's currency. Omit if category has flatPrice. Strip currency symbols.
- flatPrice on a category: set when the menu says "all items in this section are $X".
- unitZh / unitEn: short qualifier — "4 件" / "4 pcs", "半隻" / "Half", "每磅" / "per lb". Omit when not present.
- noteZh / noteEn: optional category caption — "全日供應" / "All day".
- zh: prefer Traditional Chinese (繁體). Translate when only English is shown.
- en: natural, idiomatic English. Translate when only Chinese is shown.

# Handling OCR noise

- If multiple photos are stitched together (marked "--- PHOTO N ---"), merge into one menu; do NOT duplicate items.
- If fragments look like one dish broken across lines, merge them.
- Skip junk: hours, phone numbers, legal disclaimers, photo credits, "prices subject to change", marketing taglines.

Remember: it is FAR better to emit a partial menu with best-effort translations than to fail with an empty items array.`;

const SUBMIT_MENU_TOOL: Anthropic.Tool = {
  name: "submit_menu",
  description: "Submit the fully extracted restaurant menu.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["restaurant", "currency", "categories", "items"],
    properties: {
      restaurant: {
        type: "object",
        additionalProperties: false,
        required: ["zh", "en"],
        properties: {
          zh: { type: "string", description: "Restaurant name in Traditional Chinese." },
          en: { type: "string", description: "Restaurant name in English." },
          address: { type: "string" },
          phone: { type: "string" },
        },
      },
      currency: {
        type: "string",
        description: "ISO 4217 code (USD, HKD, TWD, CNY…).",
      },
      categories: {
        type: "array",
        description: "Sections of the menu, in the order they appear.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "zh", "en"],
          properties: {
            id: { type: "string", description: "Short slug, unique within the menu." },
            zh: { type: "string" },
            en: { type: "string" },
            flatPrice: {
              type: "number",
              description: "Price that applies to every item in this category.",
            },
            noteZh: { type: "string" },
            noteEn: { type: "string" },
          },
        },
      },
      items: {
        type: "array",
        description: "Every dish visible on the menu.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "category", "zh", "en"],
          properties: {
            id: { type: "string", description: "Slug-style unique id." },
            code: {
              type: "string",
              description: "Menu code printed next to the item (A1, B7). Omit if none.",
            },
            category: {
              type: "string",
              description: "Must match one categories[].id.",
            },
            zh: { type: "string" },
            en: { type: "string" },
            price: { type: "number" },
            unitZh: { type: "string" },
            unitEn: { type: "string" },
          },
        },
      },
    },
  },
};

export type ParseMenuResult = {
  menu: ParsedMenu;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
};

async function ocrImage(
  client: Anthropic,
  image: MenuImage
): Promise<{ text: string; usage: Anthropic.Messages.Usage }> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2500,
    temperature: 0,
    system: [
      {
        type: "text",
        text: OCR_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.mediaType,
              data: image.data,
            },
          },
          {
            type: "text",
            text: "Transcribe all visible text from this menu photo. Plain text only, preserving order. Do not refuse, do not summarize.",
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("OCR returned empty text");
  }
  return { text, usage: response.usage };
}

async function structureMenu(
  client: Anthropic,
  ocrTexts: string[]
): Promise<{ menu: ParsedMenu; usage: Anthropic.Messages.Usage }> {
  const userText =
    ocrTexts.length === 1
      ? `OCR'd menu text:\n\n${ocrTexts[0]}`
      : `OCR'd text from ${ocrTexts.length} menu photos. Merge them into one menu.\n\n` +
        ocrTexts.map((t, i) => `--- PHOTO ${i + 1} ---\n${t}`).join("\n\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
    temperature: 0,
    system: [
      {
        type: "text",
        text: STRUCTURE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SUBMIT_MENU_TOOL],
    tool_choice: { type: "tool", name: "submit_menu" },
    messages: [{ role: "user", content: userText }],
  });

  const toolUse = response.content.find(
    (block) => block.type === "tool_use" && block.name === "submit_menu"
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      "Claude did not call submit_menu — OCR text may be unreadable"
    );
  }
  return { menu: toolUse.input as ParsedMenu, usage: response.usage };
}

export async function parseMenu(images: MenuImage[]): Promise<ParseMenuResult> {
  if (images.length === 0) {
    throw new Error("at least one image is required");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const client = new Anthropic({ apiKey });

  const t0 = Date.now();
  console.log(`[parseMenu] start: ${images.length} image(s)`);

  // Stage 1: parallel OCR, fault-tolerant per image.
  const ocrSettled = await Promise.allSettled(
    images.map(async (img, i) => {
      const start = Date.now();
      const result = await ocrImage(client, img);
      const preview = result.text.slice(0, 150).replace(/\s+/g, " ");
      console.log(
        `[parseMenu] OCR ${i + 1}/${images.length} ✓ ${
          Date.now() - start
        }ms ${result.text.length}ch | ${preview}…`
      );
      return result;
    })
  );

  const okOcr = ocrSettled
    .map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      console.error(
        `[parseMenu] OCR ${i + 1}/${images.length} ✗ ${
          r.reason instanceof Error ? r.reason.message : String(r.reason)
        }`
      );
      return null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  console.log(
    `[parseMenu] stage 1 done in ${Date.now() - t0}ms (${okOcr.length}/${
      images.length
    } images OCRd)`
  );

  if (okOcr.length === 0) {
    throw new Error(
      "Couldn't read any of your menu photos. Try clearer, well-lit shots."
    );
  }

  // Stage 2: text-only structuring.
  const t1 = Date.now();
  const ocrTexts = okOcr.map((r) => r.text);
  const { menu: rawMenu, usage: structureUsage } = await structureMenu(
    client,
    ocrTexts
  );
  console.log(
    `[parseMenu] stage 2 done in ${Date.now() - t1}ms (raw: ${
      rawMenu?.items?.length ?? 0
    } items, ${rawMenu?.categories?.length ?? 0} categories)`
  );

  const menu = repairMenu(rawMenu);
  validateMenu(menu);

  console.log(
    `[parseMenu] total: ${Date.now() - t0}ms (final: ${menu.items.length} items, ${menu.categories.length} categories)`
  );

  // Aggregate usage across all calls.
  const totalUsage = okOcr.reduce(
    (acc, r) => ({
      input_tokens: acc.input_tokens + r.usage.input_tokens,
      output_tokens: acc.output_tokens + r.usage.output_tokens,
      cache_read_input_tokens:
        acc.cache_read_input_tokens + (r.usage.cache_read_input_tokens ?? 0),
      cache_creation_input_tokens:
        acc.cache_creation_input_tokens +
        (r.usage.cache_creation_input_tokens ?? 0),
    }),
    {
      input_tokens: structureUsage.input_tokens,
      output_tokens: structureUsage.output_tokens,
      cache_read_input_tokens: structureUsage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens:
        structureUsage.cache_creation_input_tokens ?? 0,
    }
  );

  return { menu, usage: totalUsage };
}

/**
 * Auto-fix common model output issues so we don't blow up on near-misses:
 *   - Dedup category ids and item ids (suffix -2, -3…).
 *   - If item.category doesn't match any category, reassign to the first one
 *     (better to show the item under the wrong section than drop it).
 *   - If categories array is missing, synthesize a single "menu" category.
 *   - Trim whitespace on string fields.
 */
function repairMenu(menu: ParsedMenu): ParsedMenu {
  if (!menu || typeof menu !== "object") {
    throw new Error("structuring returned non-object");
  }

  const repaired: ParsedMenu = {
    ...menu,
    restaurant: {
      zh: menu.restaurant?.zh?.trim() || "餐廳",
      en: menu.restaurant?.en?.trim() || "Restaurant",
      address: menu.restaurant?.address?.trim() || undefined,
      phone: menu.restaurant?.phone?.trim() || undefined,
    },
    currency: menu.currency?.trim() || "USD",
    categories: Array.isArray(menu.categories) ? [...menu.categories] : [],
    items: Array.isArray(menu.items) ? [...menu.items] : [],
  };

  // Synthesize a category if none exist but we have items.
  if (repaired.categories.length === 0 && repaired.items.length > 0) {
    repaired.categories.push({ id: "menu", zh: "菜單", en: "Menu" });
  }

  // Dedup category ids.
  const seenCatIds = new Set<string>();
  repaired.categories = repaired.categories.map((c) => {
    let id = c.id?.trim() || `cat-${seenCatIds.size + 1}`;
    if (seenCatIds.has(id)) {
      let n = 2;
      while (seenCatIds.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    seenCatIds.add(id);
    return { ...c, id, zh: c.zh?.trim() || id, en: c.en?.trim() || id };
  });

  // Reassign orphan items + dedup item ids.
  const validCatIds = new Set(repaired.categories.map((c) => c.id));
  const fallbackCat = repaired.categories[0]?.id;
  const seenItemIds = new Set<string>();
  repaired.items = repaired.items.map((item, i) => {
    let id = item.id?.trim() || `item-${i + 1}`;
    if (seenItemIds.has(id)) {
      let n = 2;
      while (seenItemIds.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    seenItemIds.add(id);

    const category = validCatIds.has(item.category) ? item.category : fallbackCat;
    return {
      ...item,
      id,
      category: category!,
      zh: item.zh?.trim() || item.en?.trim() || id,
      en: item.en?.trim() || item.zh?.trim() || id,
    };
  });

  return repaired;
}

function validateMenu(menu: ParsedMenu): void {
  if (!menu || typeof menu !== "object") {
    throw new Error("menu must be an object");
  }
  if (!menu.restaurant?.zh || !menu.restaurant?.en) {
    throw new Error("restaurant name (zh + en) is required");
  }
  if (!Array.isArray(menu.categories) || menu.categories.length === 0) {
    throw new Error("menu must have at least one category");
  }
  if (!Array.isArray(menu.items) || menu.items.length === 0) {
    throw new Error(
      "Couldn't extract any dishes — the photos may be too blurry or empty."
    );
  }
  // ids and category references are already repaired upstream — just sanity check.
  const catIds = new Set(menu.categories.map((c) => c.id));
  for (const item of menu.items) {
    if (!catIds.has(item.category)) {
      throw new Error(
        `internal: item ${item.id} → unknown category ${item.category}`
      );
    }
  }
}
