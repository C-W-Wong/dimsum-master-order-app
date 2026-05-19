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
 *   2. Combined OCR text → Sonnet 4.6 text-only structuring via submit_menu tool.
 *
 * Two-stage is dramatically faster than a single Sonnet vision call because:
 *   - Haiku is ~3× faster than Sonnet, and OCR (no reasoning) suits it.
 *   - Sonnet on text-only is ~3× faster than Sonnet on vision.
 *   - OCR for N photos runs in parallel; total wall-clock = max(OCR) + structure.
 *
 * Both system prompts use cache_control: ephemeral so the static prefixes hit
 * Anthropic's 5-min prompt cache after the first call.
 */

const OCR_SYSTEM_PROMPT = `You are an OCR engine for restaurant menus. Your only job is to transcribe text from the photo verbatim.

Rules:
- Transcribe EVERY visible character: dish names (any language), prices, item codes (A1, B7, F12), category headers, notes, units (件, pcs, lb, oz, 隻, 半隻), currency symbols, taglines.
- Preserve the visual order — top-to-bottom, then left-to-right for multi-column menus.
- Keep Chinese characters as Chinese; Japanese as Japanese; etc. Do NOT translate.
- For each row, keep name and price on the same line. Separate with two spaces.
- Use a blank line between menu sections.
- If a value is unclear, transcribe your best guess — don't omit the row.
- Do NOT interpret, structure, JSON-ify, summarize, or comment. Output transcription only.`;

const STRUCTURE_SYSTEM_PROMPT = `You are a restaurant-menu structuring expert.

You will receive OCR-transcribed text from one or more menu photos. The OCR is faithful to the photo but may have garbled characters, broken layout, duplicate fragments, or items split across lines. Your job is to clean it up and call the submit_menu tool with structured data.

# Output contract

Call submit_menu exactly once with the complete menu. Do not write any other text.

# Required fields

- restaurant.zh — restaurant name in Traditional Chinese. Translate if menu only shows English.
- restaurant.en — restaurant name in English. Translate if menu only shows Chinese.
- currency — ISO 4217 code: "USD" (default for US menus), "HKD" (Hong Kong), "TWD" (Taiwan), "CNY", "CAD", "EUR", "JPY", "GBP", etc.
- categories — every section visible in the OCR, in the order they appear.
- items — every visible dish. Be exhaustive.

# Field rules

- IDs are short slugs in lower-snake-case, unique within the menu. Prefer the menu code lowercased when one exists ("a1", "b7", "f12"), otherwise derive from the English name ("shrimp-har-gow"). Never reuse an id.
- Every item.category must EXACTLY match one categories[].id you produced. Validate before emitting.
- zh: prefer Traditional Chinese (繁體) unless the menu is clearly Simplified. Translate faithfully when only English is shown.
- en: natural, idiomatic English. Translate faithfully when only Chinese is shown.
- code: only set when a menu number is printed next to the item ("A1", "B7", "C12", "F19"). Omit otherwise.
- price: numeric, in the menu's currency. Omit if the category's flatPrice applies. Strip currency symbols (the currency is stored separately).
- flatPrice on a category: set when the menu says "all items in this section are $X". Items in that category should usually omit their own price.
- unitZh / unitEn: short qualifier shown on the menu — "4 件" / "4 pcs", "半隻" / "Half", "每磅" / "per lb". Omit when not present.
- noteZh / noteEn: optional category caption — "全日供應" / "All day", "等候約 10 分鐘" / "≈ 10 min wait".

# Handling OCR noise

- If multiple photos are stitched together (separated by "--- PHOTO N ---"), merge them into one menu and do NOT duplicate items that appear on multiple photos.
- If fragments look like a single dish broken across lines, merge them.
- Skip OCR junk: hours, phone numbers (unless restaurant.phone), legal disclaimers, photography credits, "prices subject to change", marketing taglines.

Be exhaustive, precise, and consistent. If a value is ambiguous, prefer leaving the optional field out over guessing.`;

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
    max_tokens: 3000,
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
            text: "Transcribe all visible text from this menu photo. Plain text only, preserving order.",
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
    throw new Error("OCR returned empty text — try a clearer photo");
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
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
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

  // Stage 1: parallel OCR.
  const ocrResults = await Promise.all(
    images.map(async (img, i) => {
      const start = Date.now();
      const result = await ocrImage(client, img);
      console.log(
        `[parseMenu] OCR ${i + 1}/${images.length} done in ${
          Date.now() - start
        }ms (${result.text.length} chars)`
      );
      return result;
    })
  );
  const ocrTexts = ocrResults.map((r) => r.text);
  console.log(`[parseMenu] stage 1 (OCR) total: ${Date.now() - t0}ms`);

  // Stage 2: text-only structuring.
  const t1 = Date.now();
  const { menu, usage: structureUsage } = await structureMenu(client, ocrTexts);
  console.log(`[parseMenu] stage 2 (structure) done in ${Date.now() - t1}ms`);
  console.log(`[parseMenu] total: ${Date.now() - t0}ms`);

  validateMenu(menu);

  // Aggregate usage across all calls so the caller sees the true cost.
  const totalUsage = ocrResults.reduce(
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
    throw new Error("menu must have at least one item");
  }

  const catIds = new Set<string>();
  for (const c of menu.categories) {
    if (!c.id || !c.zh || !c.en) {
      throw new Error(`category missing id/zh/en: ${JSON.stringify(c)}`);
    }
    if (catIds.has(c.id)) {
      throw new Error(`duplicate category id: ${c.id}`);
    }
    catIds.add(c.id);
  }

  const itemIds = new Set<string>();
  for (const item of menu.items) {
    if (!item.id || !item.zh || !item.en || !item.category) {
      throw new Error(`item missing required fields: ${JSON.stringify(item)}`);
    }
    if (!catIds.has(item.category)) {
      throw new Error(
        `item ${item.id} references unknown category ${item.category}`
      );
    }
    if (itemIds.has(item.id)) {
      throw new Error(`duplicate item id: ${item.id}`);
    }
    itemIds.add(item.id);
  }
}
