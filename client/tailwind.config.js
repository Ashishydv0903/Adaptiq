/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mint: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#52D68A', // The exact signature mint from photo
          500: '#34D399',
          600: '#10B981',
          700: '#059669',
          800: '#065F46',
          900: '#064E3B',
          dark: '#0B192C'
        },
        navy: {
          950: '#07101B',
          900: '#0B192C', // Signature deep dark blue background from photo
          850: '#0F2238', // Card surfaces
          800: '#132A46',
          700: '#1B3A60', // Card borders
          600: '#2A4E7A'
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        }
      }
    },
  },
  plugins: [],
}
