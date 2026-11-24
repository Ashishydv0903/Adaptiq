/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.875rem' }],
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1.15' }],
        '6xl': ['3.75rem', { lineHeight: '1.1' }]
      },
      borderRadius: {
        none: '0',
        xs: '0.25rem',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        full: '9999px'
      },
      spacing: {
        4.5: '1.125rem',
        5.5: '1.375rem',
        18: '4.5rem',
        88: '22rem',
        112: '28rem',
        128: '32rem'
      },
      colors: {
        mint: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#52D68A', // Signature mint
          500: '#34D399',
          600: '#10B981',
          700: '#059669',
          800: '#065F46',
          900: '#064E3B',
          dark: '#0B192C'
        },
        navy: {
          950: '#07101B',
          900: '#0B192C', // Deep dark blue background
          850: '#0F2238', // Card surface
          800: '#132A46', // Elevated surface
          700: '#1B3A60', // Card border
          600: '#2A4E7A'  // Hover border
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
