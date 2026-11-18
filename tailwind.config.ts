import type { Config } from 'tailwindcss';

// Andreal brand: near-black / charcoal base, cyan-teal accent, coral-red (#FF4E42) for emphasis.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0b0d10', 900: '#111418', 850: '#161a1f', 800: '#1c2127', 700: '#262c34', 600: '#343b45', 500: '#4a525e' },
        teal: { 300: '#7ee8df', 400: '#3fd6c8', 500: '#1fbfb0', 600: '#16968b' },
        coral: { 300: '#ff8a81', 400: '#ff6a60', 500: '#ff4e42', 600: '#e03a2f' },
        rag: { green: '#2fbf71', amber: '#f2a93b', red: '#ff4e42', none: '#6b7280' },
      },
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Archivo', 'Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
