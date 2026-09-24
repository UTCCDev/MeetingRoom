import type { Config } from "tailwindcss";

// Heavent DS v0.1.6 (design.md). The blue/gray scales and the text-* sizes are
// remapped to the DS so existing pages pick it up without class changes;
// new code should prefer the semantic names (primary, ink, outline, …).
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DB Heavent"', 'Prompt', 'Noto Sans Thai', 'system-ui', 'sans-serif'],
      },
      // DB Heavent ships Light / Medium / Bold only — map the in-between weights
      // so the browser never synthesises a faux bold.
      fontWeight: {
        normal: '300',
        medium: '500',
        semibold: '500',
        bold: '700',
      },
      // DB Heavent has a small x-height, so every step is one size up from the
      // Latin scale (root 16px). Thai body text never goes below 18px.
      fontSize: {
        xs: ['0.875rem', { lineHeight: '1.4' }],    // label-small 14
        sm: ['1.125rem', { lineHeight: '1.6' }],    // body-small 18
        base: ['1.25rem', { lineHeight: '1.65' }],  // body-medium 20
        lg: ['1.5rem', { lineHeight: '1.35' }],     // title-medium 24
        xl: ['1.75rem', { lineHeight: '1.3' }],     // title-large 28
        '2xl': ['2rem', { lineHeight: '1.25' }],    // headline-small 32
        '3xl': ['2.25rem', { lineHeight: '1.22' }], // headline-medium 36
        '4xl': ['2.5rem', { lineHeight: '1.2' }],   // headline-large 40
        '5xl': ['3rem', { lineHeight: '1.15' }],    // display-small 48
        '6xl': ['4rem', { lineHeight: '1.08' }],    // display-medium 64
        '7xl': ['5.5rem', { lineHeight: '0.98' }],  // display-large 88

        'display-large': ['5.5rem', { lineHeight: '0.98', fontWeight: '700' }],
        'display-medium': ['4rem', { lineHeight: '1.08', fontWeight: '700' }],
        'display-small': ['3rem', { lineHeight: '1.15', fontWeight: '700' }],
        'headline-large': ['2.5rem', { lineHeight: '1.2', fontWeight: '700' }],
        'headline-medium': ['2.25rem', { lineHeight: '1.22', fontWeight: '500' }],
        'headline-small': ['2rem', { lineHeight: '1.25', fontWeight: '500' }],
        'title-large': ['1.75rem', { lineHeight: '1.3', fontWeight: '500' }],
        'title-medium': ['1.5rem', { lineHeight: '1.35', fontWeight: '500' }],
        'title-small': ['1.25rem', { lineHeight: '1.4', fontWeight: '500' }],
        'body-large': ['1.5rem', { lineHeight: '1.6', fontWeight: '300' }],
        'body-medium': ['1.25rem', { lineHeight: '1.65', fontWeight: '300' }],
        'body-small': ['1.125rem', { lineHeight: '1.6', fontWeight: '300' }],
        'label-large': ['1.125rem', { lineHeight: '1.4', fontWeight: '500' }],
        'label-medium': ['1rem', { lineHeight: '1.4', fontWeight: '500' }],
        'label-small': ['0.875rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
      maxWidth: {
        prose: '42.5rem',
      },
      // design.md radius scale: xs 4 · s 8 · m 12 · l 16 · xl 28 · full.
      // s/m/l live on Tailwind's sm/md/lg names: `rounded-s` and `rounded-l`
      // are built-in start/left-side utilities (4px) and would override corners.
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '28px',
      },
      colors: {
        // Heavent DS v0.1.6 — tonal palettes (10–99) and the roles built on them.
        // Prefer the role names (primary, on-primary-container, error-container, …).
        primary: {
          DEFAULT: '#2E3192',
          hover: '#232670',
          pressed: '#1B1E5C',
          container: '#E8E9F6',
          10: '#0B0C33', 20: '#151757', 30: '#1F2275', 40: '#2E3192', 50: '#4548AB',
          60: '#6164C2', 70: '#8487D4', 80: '#A9ABE4', 90: '#D2D3F2', 95: '#E8E9F6', 99: '#F8F8FD',
          // legacy scale steps used by older pages
          700: '#2E3192',
          800: '#232670',
        },
        accent: {
          DEFAULT: '#00709A', // text-safe accent (5.5:1 on white)
          container: '#E1F6FD',
          10: '#002231', 20: '#003A52', 30: '#005475', 40: '#00709A', 50: '#0089B8',
          60: '#00B1EB', 70: '#45C6F2', 80: '#85D9F6', 90: '#C2ECFA', 95: '#E1F6FD', 99: '#F5FCFF',
        },
        highlight: {
          DEFAULT: '#FFC709', // never a background for white text
          container: '#FFF4CC',
          10: '#2A1F00', 20: '#463400', 30: '#634A00', 40: '#7A5A00', 50: '#9E7600',
          60: '#C79500', 70: '#FFC709', 80: '#FFD84D', 90: '#FFEBA6', 95: '#FFF4CC', 99: '#FFFCF2',
        },
        error: {
          DEFAULT: '#B42318',
          container: '#FDF1F1',
          10: '#410E0B', 20: '#6B1610', 30: '#8A1C12', 40: '#B42318', 50: '#D93025',
          60: '#EB5A4F', 70: '#F28B82', 80: '#F6B3AD', 90: '#FAD7D4', 95: '#FDF1F1', 99: '#FFFBFB',
        },
        success: {
          DEFAULT: '#146C3A',
          container: '#EEF9F2',
          10: '#06291A', 20: '#0C4527', 30: '#0F5A31', 40: '#146C3A', 50: '#1E8A4B',
          60: '#34A865', 70: '#5CC486', 80: '#8FDAAC', 90: '#C6EFD5', 95: '#EEF9F2', 99: '#F8FDF9',
        },
        neutral: {
          10: '#12142E', 20: '#262944', 30: '#3D4160', 40: '#545878', 50: '#6A6F91',
          60: '#8B8FA8', 70: '#A9ACC0', 80: '#C6C9DC', 90: '#E2E4EE', 95: '#F1F2F8', 99: '#FAFBFD',
        },
        'on-primary': '#FFFFFF',
        'on-primary-container': '#151757',
        'on-accent': '#FFFFFF',
        'on-accent-container': '#003A52',
        'on-highlight': '#12142E',
        'on-highlight-container': '#7A5A00',
        'on-error': '#FFFFFF',
        'on-error-container': '#8A1C12',
        'on-success-container': '#146C3A',
        surface: {
          DEFAULT: '#FFFFFF',
          variant: '#F1F2F8',
        },
        canvas: '#FAFBFD',
        ink: {
          DEFAULT: '#12142E',
          muted: '#3D4160',
          subtle: '#6A6F91',
        },
        outline: '#C6C9DC',
        line: '#E2E4EE',
        focus: '#00B1EB',
        disabled: {
          bg: '#E4E5EC',
          fg: '#8B8FA8',
        },

        // Legacy Tailwind scales used across the pages, re-pointed at the DS palettes.
        blue: {
          50: '#F8F8FD', 100: '#E8E9F6', 200: '#D2D3F2', 300: '#A9ABE4', 400: '#8487D4',
          500: '#6164C2', 600: '#4548AB', 700: '#2E3192', 800: '#1F2275', 900: '#151757', 950: '#0B0C33',
        },
        gray: {
          50: '#FAFBFD', 100: '#F1F2F8', 200: '#E2E4EE', 300: '#C6C9DC', 400: '#8B8FA8',
          500: '#6A6F91', 600: '#545878', 700: '#3D4160', 800: '#262944', 900: '#12142E', 950: '#0A0B1C',
        },
        status: {
          available: '#146C3A',
          booked: '#B42318',
          pending: '#FFC709',
        },
      },
    },
  },
  plugins: [],
};
export default config;
