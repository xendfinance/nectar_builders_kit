/**
 * Palette mirrors the main app (nectar-frontend/tailwind.config.js): primary #00EC97, the gray scale and red-alpha.
 * Series colors for charts live in src/lib/chartTheme.ts so Recharts and lightweight-charts share them.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#00EC97",
          dark: "#00BD79",
          muted: "#00EC9729",
          faint: "#00EC9714",
        },
        surface: {
          base: "#0C0C0C",
          card: "#161616",
          raised: "#1F1F1F",
          line: "#333333",
        },
        ink: {
          DEFAULT: "#FFFFFF",
          muted: "#9E9E9E",
          faint: "#6D6D6D",
        },
        long: "#00EC97",
        short: "#EF476F",
        warn: "#F5B841",
        info: "#3987E5",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
