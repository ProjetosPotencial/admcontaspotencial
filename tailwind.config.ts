import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Guia de cores - Design Prompts Sistema Potencial Contas v1.0
        ebano: { DEFAULT: "#1a1a1a", 2: "#2a2a2a", 3: "#3a3a3a" }, // preto / sidebar / hover sidebar
        amarelo: { DEFAULT: "#FFC107", dark: "#FFB300", light: "#fff3cd" },
        papel: "#f5f5f5",
        off: "#f9f9f9",
        linha: "#e0e0e0",
        linha2: "#f0f0f0",
        txt: { DEFAULT: "#1a1a1a", 2: "#666666", 3: "#999999" },
        ok: { DEFAULT: "#4caf50", bg: "#e8f5e9", dark: "#45a049" },
        alerr: { DEFAULT: "#f44336", bg: "#ffebee", dark: "#da190b" },
        amb: { DEFAULT: "#FFC107", bg: "#fff3cd" },
        info: { DEFAULT: "#2196f3", bg: "#e3f2fd" },
      },
      fontFamily: {
        disp: ["var(--font-poppins)", "-apple-system", "sans-serif"],
        body: ["var(--font-inter)", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        leve: "0 2px 8px rgba(0,0,0,0.08)",
        media: "0 4px 16px rgba(0,0,0,0.12)",
        forte: "0 8px 24px rgba(0,0,0,0.16)",
      },
    },
  },
  plugins: [],
};
export default config;
