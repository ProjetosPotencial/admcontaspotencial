import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ebano: { DEFAULT: "#0D0D0D", 2: "#161616", 3: "#1f1f1f" },
        amarelo: { DEFAULT: "#FFB600", soft: "#FFD54D" },
        petroleo: { DEFAULT: "#1B6E7E", dark: "#12525e" },
        papel: "#F4F3EF",
        off: "#FAFAFA",
        linha: "#E7E5DF",
        linha2: "#EFEDE7",
        txt: { DEFAULT: "#151515", 2: "#5c5a54", 3: "#8a8880" },
        ok: { DEFAULT: "#2E7D57", bg: "#E4F1EA" },
        amb: { DEFAULT: "#B57A12", bg: "#FBF0D9" },
        alerr: { DEFAULT: "#B23B3B", bg: "#F7E4E2" },
      },
      fontFamily: {
        disp: ["var(--font-poppins)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
