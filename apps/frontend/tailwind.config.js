/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Single source of truth for the palette; components reference these
        // names rather than repeating hex values.
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8fafc',
          border: '#e2e8f0',
        },
        brand: {
          50: '#eef4ff',
          100: '#dbe6fe',
          500: '#4f6ef7',
          600: '#3b55e0',
          700: '#2f43b8',
        },
        status: {
          scheduled: '#b45309',
          sent: '#047857',
          failed: '#b91c1c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
