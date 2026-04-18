import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Couleur principale : Vert Dash Meal ─────────────────────────────
        brand: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",  // PRIMARY
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        // ── Couleur accent : Jaune/Or ────────────────────────────────────────
        accent: {
          50:  "#fefce8",
          100: "#fef9c3",
          200: "#fef08a",
          300: "#fde047",
          400: "#facc15",
          500: "#eab308",  // ACCENT
          600: "#ca8a04",
          700: "#a16207",
          800: "#854d0e",
          900: "#713f12",
        },
        // ── Surfaces claires (thème clair) ──────────────────────────────────
        surface: {
          950: "#f8fafc",   // fond principal (slate-50)
          900: "#f1f5f9",   // fond légèrement plus foncé
          850: "#e8f5e9",   // teinte verte douce
          800: "#ffffff",   // cartes (blanc)
          700: "#f0fdf4",   // hover cartes
          600: "#e2e8f0",   // bordures / inputs
          500: "#cbd5e1",   // bordures secondaires
          400: "#94a3b8",   // texte désactivé / icônes muted
          300: "#64748b",   // texte secondaire
        },
        border:     "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
      },
      borderRadius: {
        xl:  "1rem",
        lg:  "0.75rem",
        md:  "0.5rem",
        sm:  "0.375rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card:  "0 1px 3px 0 rgb(0 0 0 / .06), 0 1px 2px -1px rgb(0 0 0 / .06)",
        "card-hover": "0 4px 6px -1px rgb(0 0 0 / .07), 0 2px 4px -2px rgb(0 0 0 / .07)",
        green: "0 4px 14px 0 rgb(22 163 74 / .25)",
        yellow:"0 4px 14px 0 rgb(234 179 8 / .25)",
      },
      keyframes: {
        "fade-in":   { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "fade-up":   { from: { opacity: "0", transform: "translateY(20px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "slide-in":  { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "scale-in":  { from: { opacity: "0", transform: "scale(0.95)" }, to: { opacity: "1", transform: "scale(1)" } },
        "shimmer":   { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
        "float":     { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
      },
      animation: {
        "fade-in":  "fade-in 0.25s ease-out",
        "fade-up":  "fade-up 0.4s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "shimmer":  "shimmer 2.5s linear infinite",
        "float":    "float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
