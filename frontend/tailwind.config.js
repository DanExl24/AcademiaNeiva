/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'color-mix(in srgb, var(--color-primary, #4f46e5) 5%, white)',
          100: 'color-mix(in srgb, var(--color-primary, #4f46e5) 10%, white)',
          200: 'color-mix(in srgb, var(--color-primary, #4f46e5) 20%, white)',
          300: 'color-mix(in srgb, var(--color-primary, #4f46e5) 30%, white)',
          400: 'color-mix(in srgb, var(--color-primary, #4f46e5) 50%, white)',
          500: 'color-mix(in srgb, var(--color-primary, #4f46e5) 70%, white)',
          600: 'var(--color-primary, #4f46e5)',
          700: 'color-mix(in srgb, var(--color-primary, #4f46e5) 85%, black)',
          800: 'color-mix(in srgb, var(--color-primary, #4f46e5) 90%, black)',
          900: 'color-mix(in srgb, var(--color-primary, #4f46e5) 95%, black)',
          950: 'color-mix(in srgb, var(--color-primary, #4f46e5) 98%, black)',
          primary: 'var(--color-primary, #4f46e5)',
          secondary: 'var(--color-secondary, #0f172a)',
        },
        indigo: {
          50: 'color-mix(in srgb, var(--color-primary, #4f46e5) 5%, white)',
          100: 'color-mix(in srgb, var(--color-primary, #4f46e5) 10%, white)',
          200: 'color-mix(in srgb, var(--color-primary, #4f46e5) 20%, white)',
          300: 'color-mix(in srgb, var(--color-primary, #4f46e5) 30%, white)',
          400: 'color-mix(in srgb, var(--color-primary, #4f46e5) 50%, white)',
          500: 'color-mix(in srgb, var(--color-primary, #4f46e5) 70%, white)',
          600: 'var(--color-primary, #4f46e5)',
          700: 'color-mix(in srgb, var(--color-primary, #4f46e5) 85%, black)',
          800: 'color-mix(in srgb, var(--color-primary, #4f46e5) 90%, black)',
          900: 'color-mix(in srgb, var(--color-primary, #4f46e5) 95%, black)',
          950: 'color-mix(in srgb, var(--color-primary, #4f46e5) 98%, black)',
        }
      }
    },
  },
  plugins: [],
}
