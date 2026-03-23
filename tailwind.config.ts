import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        fg: "var(--foreground)",
        bg: "var(--background)",
        line: "var(--border)",
        muted: "var(--muted)",
        brand: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          50: "var(--primary-50)",
          100: "var(--primary-100)",
          200: "var(--primary-200)",
          300: "var(--primary-300)",
          400: "var(--primary-400)",
          500: "var(--primary-500)",
          600: "var(--primary-600)",
          700: "var(--primary-700)",
          800: "var(--primary-800)",
          900: "var(--primary-900)",
        },
        edu: {
          green: "var(--edu-green)",
          greenLight: "var(--edu-greenLight)",
          greenMuted: "var(--edu-greenMuted)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          50: "var(--accent-50)",
          100: "var(--accent-100)",
          200: "var(--accent-200)",
          300: "var(--accent-300)",
          400: "var(--accent-400)",
          500: "var(--accent-500)",
          600: "var(--accent-600)",
        },
        /* Semantic – dùng trong component để dễ đổi theme */
        action: {
          DEFAULT: "var(--color-action)",
          hover: "var(--color-action-hover)",
          foreground: "var(--color-action-foreground)",
          muted: "var(--color-action-muted)",
          "muted-foreground": "var(--color-action-muted-foreground)",
        },
        semantic: {
          heading: "var(--text-heading)",
          body: "var(--text-body)",
        },
        "surface-card": "var(--surface-card)",
        "surface-elevated": "var(--surface-elevated)",
        "border-subtle": "var(--border-subtle)",
        "border-strong": "var(--border-strong)",
        surface: {
          DEFAULT: "var(--surface)",
          card: "var(--surface-card)",
          muted: "var(--surface-muted)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "Times New Roman", "serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        cardHover: "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05)",
        glow: "0 0 0 1px rgb(29 78 216 / 0.1), 0 4px 12px -2px rgb(29 78 216 / 0.15)",
        premium: "0 20px 40px -24px rgb(15 23 42 / 0.35), 0 10px 18px -14px rgb(15 23 42 / 0.25)",
        insetSoft: "inset 0 1px 0 0 rgb(255 255 255 / 0.5)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
