import type { Config } from "tailwindcss";

// Heavent DS v0.1 (design.md). The blue/gray scales and the text-* sizes are
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
      borderRadius: {
        xs: '4px',
        s: '8px',
        m: '12px',
        l: '16px',
        xl: '28px',
      },
      colors: {
        primary: {
          DEFAULT: '#2E3192',
          hover: '#232670',
          pressed: '#1B1E5C',
          container: '#E8E9F6',
          700: '#2E3192',
          800: '#232670',
        },
        accent: '#00B1EB',
        highlight: '#FFC709',
        ink: {
          DEFAULT: '#12142E',
          muted: '#3D4160',
          subtle: '#6A6F91',
        },
        outline: '#C6C9DC',
        line: '#E2E4EE',
        canvas: '#FAFBFD',
        disabled: {
          bg: '#E4E5EC',
          fg: '#8B8FA8',
        },
        error: '#B42318',
        success: '#146C3A',

        // Legacy scales used across the pages, re-pointed at DS values.
        blue: {
          50: '#F3F4FB',
          100: '#E8E9F6', // primary-container
          200: '#D5D7F2',
          300: '#AEB1E0',
          400: '#7A7EC6',
          500: '#4F53AB',
          600: '#3A3E9F',
          700: '#2E3192', // primary
          800: '#232670', // primary-hover
          900: '#1B1E5C', // primary-pressed
          950: '#12142E',
        },
        gray: {
          50: '#FAFBFD',  // canvas
          100: '#F1F2F7',
          200: '#E2E4EE', // line
          300: '#C6C9DC', // outline
          400: '#8B8FA8', // disabled-fg
          500: '#6A6F91', // ink-subtle
          600: '#52577A',
          700: '#3D4160', // ink-muted
          800: '#262943',
          900: '#12142E', // ink
          950: '#0A0B1C',
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
