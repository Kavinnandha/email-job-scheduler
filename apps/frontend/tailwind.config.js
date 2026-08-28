/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Single source of truth for the palette. Components reference these
        // names rather than repeating hex values.
        brand: {
          50: '#e9f7ee',   // active nav pill, Google button fill
          100: '#d3efdd',
          400: '#22b455',
          500: '#00a63e',  // primary green - Compose border, Login button
          600: '#009336',
          700: '#00782c',
        },
        ink: {
          DEFAULT: '#1a1a1a',
          muted: '#6b7280',
          faint: '#9ca3af',
        },
        field: '#f4f5f6',   // input / search fill
        line: '#e8eaed',    // hairline borders
        chip: {
          warn: '#fdf0dd',  // scheduled time pill
          warnText: '#b45309',
          idle: '#eceef0',  // sent pill
          idleText: '#3f4652',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        pop: '0 10px 34px -6px rgba(16, 24, 40, 0.18)',
        card: '0 1px 2px rgba(16, 24, 40, 0.04)',
      },
    },
  },
  plugins: [],
};
