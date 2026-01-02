/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 自定義專案所需的顏色
        slate: {
          800: '#1e293b',
          900: '#0f172a',
        },
        cyan: {
          500: '#06b6d4',
        },
        emerald: {
          400: '#34d399',
        },
        violet: {
          400: '#a78bfa',
        },
      },
    },
  },
  plugins: [],
}