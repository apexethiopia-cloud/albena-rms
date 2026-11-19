/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fcf7e8',
          100: '#f6e8be',
          200: '#e3c265',
          500: '#b8860b',
          600: '#111111',
          700: '#8a6508',
          800: '#6b4a06',
          900: '#3f2d06',
        }
      }
    },
  },
  plugins: [],
}
