import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Remapeado para os tokens do Design System do Parcele Aqui
        // (v1.0/v1.1) - mesma estrutura de nomes que o app já usava, só
        // os valores por trás mudaram, pra cascatear pro sistema todo
        // sem precisar reescrever cada componente.
        ebano: { DEFAULT: "#0A0A0A", 2: "#16181C", 3: "#2A2C31" }, // n-950 / gray-900 / gray-800
        amarelo: { DEFAULT: "#FFB800", dark: "#E6A600", light: "#FFF9E6" }, // y-500 / y-600 / y-50
        papel: "#FAFAFA", // bg-subtle (n-50)
        off: "#F5F5F5", // bg-muted (n-100)
        linha: "#E0E0E0", // n-300
        linha2: "#EEEEEE", // n-200
        txt: { DEFAULT: "#1A1A1A", 2: "#757575", 3: "#9E9E9E" }, // n-900 / n-600 / n-500
        ok: { DEFAULT: "#2E7D32", bg: "#E8F5E9", dark: "#1B5E20" }, // g-500 / g-50 / g-600 (Green Potencial)
        alerr: { DEFAULT: "#D32F2F", bg: "#FDEDED", dark: "#B71C1C" },
        amb: { DEFAULT: "#E6A600", bg: "#FFF9E6" }, // y-600 sobre y-50, distinto do amarelo puro de CTA
        info: { DEFAULT: "#2A74C4", bg: "#EAF3FC" }, // ceu-500 / ceu-50 (paleta v1.1)
      },
      fontFamily: {
        disp: ["var(--font-bricolage)", "-apple-system", "sans-serif"], // Display/Heading
        body: ["var(--font-hanken)", "-apple-system", "sans-serif"], // Body/UI
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        leve: "0 1px 2px rgba(10,10,10,0.05)", // shadow-xs/sm
        media: "0 4px 12px rgba(10,10,10,0.10)", // shadow-md
        forte: "0 12px 32px rgba(10,10,10,0.16)", // shadow-xl
      },
      borderRadius: {
        // escala oficial do DS: r-xs 4 · r-sm 6 · r-md 8 · r-lg 12 · r-xl 16 · r-2xl 24 · r-full pill
        xl: "1rem",
        "2xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
export default config;
