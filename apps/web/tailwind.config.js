/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A1A1A',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#D4AF37',
          foreground: '#1A1A1A',
        },
        background: '#FFFFFF',
        foreground: '#1A1A1A',
        card: '#FFFFFF',
        'card-foreground': '#1A1A1A',
        muted: {
          DEFAULT: '#F5F5F5',
          foreground: '#737373',
        },
        secondary: {
          DEFAULT: '#F5F5F5',
          foreground: '#1A1A1A',
        },
        destructive: {
          DEFAULT: '#FF3B30',
          foreground: '#FFFFFF',
        },
        border: '#E5E5E5',
        input: '#E5E5E5',
        ring: '#1A1A1A',
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
    },
  },
  plugins: [],
}
