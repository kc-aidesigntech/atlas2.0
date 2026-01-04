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
        "brand-amber": "#FFB400",
        "brand-coral": "#FF6319",
        "brand-lime": "#22C55E",
        "brand-violet": "#B933AD",
        "brand-orange": "#FCCC0A",
        "brand-blue": "#0039A6",
        "brand-red": "#EE352E",
        "brand-gray": "#A7A9AC",
        "brand-brown": "#996633",
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
          DEFAULT: "#FFB400",
          foreground: "#000000",
        },
        service: {
          housing: "#0039A6",
          financial: "#FF6319",
          mental: "#B933AD",
          education: "#A7A9AC",
          occupational: "#FCCC0A",
          justice: "#996633",
          social: "#EE352E",
          mobility: "#01A89E",
          wellness: "#6CBE45",
          crisis: "#FFD700",
        },
      },
      borderRadius: {
        lg: "0.875rem",
        md: "calc(0.875rem - 2px)",
        sm: "calc(0.875rem - 4px)",
      },
      fontFamily: {
        sans: ['"Helvetica Neue"', 'Helvetica'],
        display: ['"Helvetica Neue"', 'Helvetica'],
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

