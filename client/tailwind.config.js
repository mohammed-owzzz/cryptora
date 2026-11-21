/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F8F9F7',
        ink: '#111210',
        lime: {
          DEFAULT: '#C6F65A',
          soft: '#EAFBC4',
          deep: '#5C7A12',
        },
        surface: '#F0F1EE',
        line: '#E4E6E2',
        cobalt: '#2049CC',
        muted: '#6B7268',
      },
      fontFamily: {
        display: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 1px rgba(17, 18, 16, 0.025)',
        lift: '0 2px 4px rgba(17, 18, 16, 0.04), 0 16px 40px -28px rgba(17, 18, 16, 0.3)',
      },
      borderRadius: {
        card: '14px',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
        standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
