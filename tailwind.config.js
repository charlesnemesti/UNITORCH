/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './whitepaper.html', './src/**/*.{js,ts,jsx,tsx,css}'],
  theme: {
    extend: {
      colors: {
        fluor: '#FF6B00',
        ember: '#FF6B00',
        flame: '#FF4500',
        heat: '#FFB020',
        void: '#080402',
      },
      fontFamily: {
        mono: ['"Fira Code"', '"Courier New"', '"Space Mono"', 'monospace'],
        terminal: ['"VT323"', 'monospace'],
      },
    },
  },
  plugins: [],
};
