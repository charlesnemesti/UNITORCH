/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './whitepaper.html', './src/**/*.{js,ts,jsx,tsx,css}'],
  theme: {
    extend: {
      colors: {
        fluor: '#DFFF00',
        void: '#000000',
      },
      fontFamily: {
        mono: ['"Fira Code"', '"Courier New"', '"Space Mono"', 'monospace'],
        terminal: ['"VT323"', 'monospace'],
      },
    },
  },
  plugins: [],
};
