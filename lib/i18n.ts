export type Lang = "zh" | "en";

const dict = {
  // App-wide
  appName: { zh: "揪團點餐", en: "Group Menu Order" },

  // Home
  yourName: { zh: "你的稱呼", en: "Your name" },
  yourNamePlaceholder: { zh: "例：阿明", en: "e.g. Alex" },
  createRoom: { zh: "建立新房間", en: "Create new room" },
  joinRoom: { zh: "加入既有房間", en: "Join existing room" },
  roomCode: { zh: "房間代碼", en: "Room code" },
  roomCodePlaceholder: { zh: "4 位字母", en: "4 letters" },
  join: { zh: "加入", en: "Join" },
  create: { zh: "建立", en: "Create" },
  orJoinExisting: { zh: "或加入既有房間", en: "Or join an existing room" },
  needName: { zh: "請先輸入你的稱呼。", en: "Please enter your name first." },
  needCode: { zh: "請輸入房間代碼。", en: "Please enter a room code." },
  roomNotFound: {
    zh: "找不到此房間，可能已過期。",
    en: "Room not found — it may have expired.",
  },

  // Room header
  share: { zh: "分享", en: "Share" },
  copied: { zh: "已複製連結", en: "Link copied" },
  leave: { zh: "離開", en: "Leave" },
  participants: { zh: "成員", en: "Members" },
  expiresIn: { zh: "{n} 後過期", en: "Expires in {n}" },
  hours: { zh: "小時", en: "h" },
  minutes: { zh: "分鐘", en: "m" },

  // Menu
  categoryAll: { zh: "全部", en: "All" },
  add: { zh: "加入", en: "Add" },
  alreadyOrdered: { zh: "已有人點", en: "Already in basket" },
  yoursTag: { zh: "你的", en: "Yours" },
  orderedBy: { zh: "由 {names} 點", en: "by {names}" },
  qty: { zh: "份", en: "" }, // appended to count, "2 份" / "2"
  remove: { zh: "移除", en: "Remove" },
  minus: { zh: "−", en: "−" },
  plus: { zh: "＋", en: "+" },

  // Basket / order list
  basket: { zh: "點餐清單", en: "Order list" },
  basketEmpty: {
    zh: "尚未點任何項目。從上方菜單加入第一道吧！",
    en: "Nothing ordered yet. Pick something from the menu above.",
  },
  subtotal: { zh: "小計", en: "Subtotal" },
  totalItems: { zh: "共 {n} 件", en: "{n} item(s)" },
  myOrders: { zh: "我點的", en: "My picks" },
  groupOrders: { zh: "全組點餐", en: "Group picks" },

  // Confirmations / banners
  someoneAlsoOrdered: {
    zh: "{name} 也點了這道。確定要再加一份嗎？",
    en: "{name} already added this. Add another one?",
  },
  duplicateOk: { zh: "確認再加", en: "Add anyway" },
  duplicateCancel: { zh: "取消", en: "Cancel" },

  // Filters
  hideOrdered: { zh: "隱藏已點", en: "Hide ordered" },
  search: { zh: "搜尋菜單", en: "Search menu" },
  noResults: { zh: "沒有符合的項目。", en: "No matching items." },

  // Misc
  loading: { zh: "讀取中…", en: "Loading…" },
  syncError: { zh: "連線失敗，正在重試…", en: "Connection lost — retrying…" },
  lang: { zh: "中", en: "EN" },
  switchLang: { zh: "EN", en: "中" },

  // New-room flow
  newTagline: {
    zh: "拍下菜單，AI 幫你變成可點餐的清單。",
    en: "Snap the menu — AI turns it into a tappable order list.",
  },
  uploadHeading: { zh: "拍下菜單", en: "Photograph the menu" },
  uploadSubhead: {
    zh: "請對著菜單拍 1–4 張清晰照片，可以正面、背面或多頁分開拍。",
    en: "Take 1–4 clear photos of the menu — front, back, or page-by-page.",
  },
  parseMenu: { zh: "AI 解析菜單", en: "Parse menu with AI" },
  parsing: { zh: "解析中…請等候約 20 秒", en: "Parsing menu… ≈ 20 s" },
  parseFailed: {
    zh: "解析失敗，請重拍或多加幾張更清晰的照片。",
    en: "Couldn't parse the menu — try clearer or extra photos.",
  },
  reviewHeading: { zh: "確認菜單", en: "Review menu" },
  reviewSubhead: {
    zh: "輕點任一項目可修改名稱或價格，誤判可直接刪除。",
    en: "Tap any item to edit its name or price. Tap the trash icon to delete.",
  },
  openRoom: { zh: "開房間", en: "Open room" },
  needPhoto: {
    zh: "請先加入至少一張照片。",
    en: "Add at least one photo first.",
  },
  reshoot: { zh: "重拍／加照片", en: "Reshoot / add photos" },
  startOver: { zh: "重新開始", en: "Start over" },
  itemsCount: { zh: "{n} 項", en: "{n} items" },
  categoriesCount: { zh: "{n} 類", en: "{n} categories" },
} as const;

export type DictKey = keyof typeof dict;

export function t(key: DictKey, lang: Lang, vars?: Record<string, string | number>): string {
  let s: string = dict[key][lang];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

export function fmtMoney(amount: number, lang: Lang): string {
  const formatted = amount.toFixed(2);
  return lang === "zh" ? `US$${formatted}` : `$${formatted}`;
}

export function otherLang(lang: Lang): Lang {
  return lang === "zh" ? "en" : "zh";
}
