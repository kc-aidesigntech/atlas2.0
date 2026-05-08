/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border-subtle)",
        input: "var(--input-border)",
        ring: "var(--accent-color)",
        background: "var(--surface-base)",
        foreground: "var(--foreground-primary)",
        "brand-midnight": "var(--surface-base)",
        "brand-ink": "var(--surface-ink)",
        "brand-slate": "var(--surface-muted)",
        "brand-shadow": "var(--surface-panel)",
        "brand-sky": "#38BDF8",
        "brand-amber": "var(--atlas-signal-yellow)",
        "brand-coral": "var(--atlas-signal-orange)",
        "brand-lime": "var(--atlas-signal-green)",
        "brand-violet": "var(--atlas-signal-purple)",
        "brand-orange": "var(--atlas-signal-yellow)",
        "brand-blue": "var(--atlas-signal-blue)",
        "brand-red": "var(--atlas-signal-red)",
        "brand-gray": "var(--foreground-secondary)",
        "brand-brown": "var(--atlas-signal-brown)",
        surface: {
          DEFAULT: "var(--surface-panel)",
          muted: "var(--surface-muted)",
          accent: "var(--surface-accent)",
        },
        primary: {
          DEFAULT: "#FFD700",
          foreground: "#000000",
        },
        secondary: {
          DEFAULT: "var(--surface-muted)",
          foreground: "var(--foreground-primary)",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "var(--foreground-primary)",
        },
        muted: {
          DEFAULT: "var(--surface-muted)",
          foreground: "var(--foreground-secondary)",
        },
        accent: {
          DEFAULT: "var(--surface-accent)",
          foreground: "var(--foreground-primary)",
        },
        popover: {
          DEFAULT: "var(--surface-panel)",
          foreground: "var(--foreground-primary)",
        },
        card: {
          DEFAULT: "var(--card-background)",
          foreground: "var(--card-foreground)",
        },
        warning: {
          DEFAULT: "var(--atlas-signal-yellow)",
          foreground: "#000000",
        },
        service: {
          housing: "var(--atlas-signal-blue)",
          financial: "var(--atlas-signal-orange)",
          mental: "var(--atlas-signal-purple)",
          education: "var(--atlas-signal-steel)",
          occupational: "var(--atlas-signal-yellow)",
          justice: "var(--atlas-signal-brown)",
          social: "var(--atlas-signal-red)",
          mobility: "#01A89E",
          wellness: "var(--atlas-signal-green)",
          crisis: "var(--atlas-signal-yellow)",
        },
      },
      borderRadius: {
        lg: "var(--atlas-radius-control)",
        md: "calc(var(--atlas-radius-control) - 2px)",
        sm: "calc(var(--atlas-radius-control) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-body)", "Helvetica", "Arial", "sans-serif"],
        display: ["var(--font-heading)", "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 28px rgba(255, 214, 0, 0.35)",
      },
      backgroundImage: {
        "atlas-grid": "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.18) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
}

