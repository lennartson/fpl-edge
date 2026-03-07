/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#1a4a3a',
          light: '#235c49',
          dark: '#112e24',
        },
        coral: {
          DEFAULT: '#E8603C',
          light: '#ed7a5a',
          dark: '#c94e2c',
        },
        cream: {
          DEFAULT: '#F5F0E8',
          dark: '#ede6d8',
          darker: '#e2d9c8',
        },
        charcoal: '#1a1a1a',
      },
    },
  },
  plugins: [],
}
