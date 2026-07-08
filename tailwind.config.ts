import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Guia de cores - Dashboard financeiro Potencial Grupo (SaaS premium)
        ebano: { DEFAULT: "#1a1c1e", 2: "#25282b", 3: "#33373b" }, // sidebar escura, cinza quase preto
        amarelo: { DEFAULT: "#FFC107", dark: "#FFB300", light: "#fff3cd" },
        papel: "#f8f9fa", // fundo cinza ártico da página
        off: "#f9f9f9",
        linha: "#e9ecef", // borda suave dos cards
        linha2: "#f1f3f5",
        txt: { DEFAULT: "#1a1a1a", 2: "#6c757d", 3: "#adb5bd" },
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
        leve: "0 1px 3px rgba(0,0,0,0.06)", // shadow-sm, cards premium
        media: "0 4px 16px rgba(0,0,0,0.10)",
        forte: "0 8px 24px rgba(0,0,0,0.14)",
      },
      borderRadius: {
        xl: "0.85rem",
      },
    },
  },
  plugins: [],
};
export default config;
