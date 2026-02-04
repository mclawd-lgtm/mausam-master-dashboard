/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        github: {
          bg: '#ffffff',
          'bg-dark': '#0d1117',
          border: '#d0d7de',
          'border-dark': '#30363d',
          text: '#24292f',
          'text-dark': '#c9d1d9',
          muted: '#6e7781',
          'muted-dark': '#8b949e',
          accent: '#2da44e',
          'accent-dark': '#3fb950',
        }
      }
    },
  },
  plugins: [],
}