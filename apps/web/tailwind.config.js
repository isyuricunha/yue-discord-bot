/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        surface: '#0b0b0b',
        foreground: '#f5f5f5',
        border: '#1f1f1f',
        accent: '#ff6a00',
        'muted-foreground': '#a3a3a3',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 500ms ease-out',
        shimmer: 'shimmer 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
