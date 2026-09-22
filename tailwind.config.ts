import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Prompt', 'Noto Sans Thai', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Blue Essence Primary Colors
        primary: {
          700: '#1D4ED8',
          800: '#1E40AF',
        },
        // Status Colors
        status: {
          available: '#10B981',  // Emerald Green
          booked: '#F43F5E',     // Rose Red
          pending: '#F59E0B',    // Amber
        },
      },
    },
  },
  plugins: [],
};
export default config;
