import type { Config } from "tailwindcss";

export const tailwindPreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        canvas: "var(--color-canvas)",
        panel: "var(--color-panel)",
        brand: "var(--color-brand)",
        "brand-strong": "var(--color-brand-strong)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)"
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem"
      },
      boxShadow: {
        soft: "0 18px 60px -28px rgba(15, 23, 42, 0.28)"
      },
      fontFamily: {
        sans: ["Satoshi", "system-ui", "sans-serif"]
      }
    }
  }
};
