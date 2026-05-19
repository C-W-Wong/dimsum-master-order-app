import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1a0f0a",
        paper: "#fff8ef",
        accent: "#c8102e",
        gold: "#d99a3d",
        sage: "#5a8a6b",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "PingFang TC",
          "PingFang SC",
          "Noto Sans CJK TC",
          "Microsoft JhengHei",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,15,10,0.06), 0 4px 12px rgba(26,15,10,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
