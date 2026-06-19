import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Fresh Modern palette (Palette C) — see design spec section 8
        bg:           "#ffffff",
        surface:      "#f4f9f4",
        primary:      "#2d8659",
        "primary-dk": "#1f6943",
        forest:       "#1a3d2b",
        ink:          "#1a2e1a",
        muted:        "#6b7d72",
        border:       "#d8e7d8",
        warn:         "#c96f2c",
        danger:       "#c4453c",
        "info-bg":    "#eef6f0",
        gold:         "#d4a55a",
      },
      fontFamily: {
        sans:    ["var(--font-cairo)", "system-ui", "sans-serif"],
        display: ["var(--font-amiri)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
