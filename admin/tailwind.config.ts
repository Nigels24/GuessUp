import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Colors from the approved prototype (docs/prototype/GuessUp-Prototype.html).
      colors: {
        brand: { DEFAULT: "#6C4CF1", dark: "#4B2FD1", soft: "#EDE9FE", hover: "#7A5CF5" },
        accent: { DEFAULT: "#FFC83D", shadow: "#D9A21C" },
        ink: { DEFAULT: "#1E1847", 2: "#4B4770" },
        muted: "#7C789A",
        line: "#E6E3F5",
        panel: "#F5F4FB",
        sidebar: { DEFAULT: "#1B1442", text: "#CFC9F2" },
        bad: { DEFAULT: "#DC2626", soft: "#FEE2E2" },
        warn: { soft: "#FEF3C7", border: "#F2C66B" },
      },
      fontFamily: {
        display: ["var(--font-fredoka)", "var(--font-nunito)", "system-ui", "sans-serif"],
        sans: ["var(--font-nunito)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 6px 20px rgba(46, 26, 140, .08)",
        lg: "0 18px 50px rgba(30, 16, 100, .22)",
      },
    },
  },
  plugins: [],
};
export default config;
