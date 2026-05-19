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
 * System prompt is intentionally large and STATIC, so we can mark it
 * cache_control: ephemeral. Every menu-parse request reads it from cache
 * after the first one (5-min TTL refreshes on hit).
 */
const SYSTEM_PROMPT = `You are a restaurant-menu OCR and extraction expert.

You will receive one or more photos of a restaurant menu — often Chinese + English, often handwritten codes (A1, B7, F12), often with category-level pricing ("Dim Sum A — all items $5.68"). Your job is to extract the FULL menu and call the submit_menu tool with structured data.

# Output contract

Call submit_menu exactly once with the complete menu. Do not write any other text.

# Required fields

- restaurant.zh — restaurant name in Traditional Chinese. Translate if menu only shows English.
- restaurant.en — restaurant name in English. Translate if menu only shows Chinese.
- currency — ISO 4217 code: "USD" (default for US menus), "HKD" (Hong Kong), "TWD" (Taiwan), "CNY", "CAD", "EUR", "JPY", "GBP", etc.
- categories — every printed section of the menu, in the order they appear.
- items — every visible dish. Be exhaustive: a typical dim sum sheet has 40-80 items.

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

# What to ignore

- Hours, phone numbers (unless restaurant.phone), legal disclaimers, photography credits, "prices subject to change", marketing taglines.
- Item photographs themselves — only extract text/numbers.

Be exhaustive, precise, and consistent. If a value is ambiguous, prefer leaving the optional field out over guessing.`;

/**
 * One JSON Schema describing the entire parsed menu. Anthropic's tool_use
 * gives us reliable structured output without needing a Zod helper.
 */
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

export async function parseMenu(images: MenuImage[]): Promise<ParseMenuResult> {
  if (images.length === 0) {
    throw new Error("at least one image is required");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    // User explicitly accepted Sonnet 4.6 as the parser default in setup.
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // Cache the static prompt — every parse hits the same prefix.
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SUBMIT_MENU_TOOL],
    tool_choice: { type: "tool", name: "submit_menu" },
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: img.mediaType,
              data: img.data,
            },
          })),
          {
            type: "text" as const,
            text:
              images.length === 1
                ? "Extract the full menu from this photo."
                : `Extract the full menu. These ${images.length} photos are different parts of the same menu — merge them.`,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (block) => block.type === "tool_use" && block.name === "submit_menu"
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not call submit_menu — try clearer photos");
  }

  const menu = toolUse.input as ParsedMenu;
  validateMenu(menu);

  return {
    menu,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens:
        response.usage.cache_creation_input_tokens ?? 0,
    },
  };
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
