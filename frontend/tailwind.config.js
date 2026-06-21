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
        indigo: {
          50: 'color-mix(in srgb, var(--color-primary, #4f46e5) 5%, white)',
          100: 'color-mix(in srgb, var(--color-primary, #4f46e5) 10%, white)',
          200: 'color-mix(in srgb, var(--color-primary, #4f46e5) 20%, white)',
          300: 'color-mix(in srgb, var(--color-primary, #4f46e5) 30%, white)',
          400: 'color-mix(in srgb, var(--color-primary, #4f46e5) 50%, white)',
          500: 'color-mix(in srgb, var(--color-primary, #4f46e5) 70%, white)',
          600: 'var(--color-primary, #4f46e5)',
          650: 'var(--color-primary, #4f46e5)',
          700: 'color-mix(in srgb, var(--color-primary, #4f46e5) 85%, black)',
          750: 'color-mix(in srgb, var(--color-primary, #4f46e5) 88%, black)',
          800: 'color-mix(in srgb, var(--color-primary, #4f46e5) 90%, black)',
          900: 'color-mix(in srgb, var(--color-primary, #4f46e5) 95%, black)',
          950: 'color-mix(in srgb, var(--color-primary, #4f46e5) 98%, black)',
        },
        emerald: {
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
        },
        blue: {
          50: 'color-mix(in srgb, var(--color-secondary, #0f172a) 5%, white)',
          100: 'color-mix(in srgb, var(--color-secondary, #0f172a) 10%, white)',
          200: 'color-mix(in srgb, var(--color-secondary, #0f172a) 20%, white)',
          300: 'color-mix(in srgb, var(--color-secondary, #0f172a) 30%, white)',
          400: 'color-mix(in srgb, var(--color-secondary, #0f172a) 50%, white)',
          500: 'color-mix(in srgb, var(--color-secondary, #0f172a) 70%, white)',
          600: 'var(--color-secondary, #0f172a)',
          700: 'color-mix(in srgb, var(--color-secondary, #0f172a) 85%, black)',
          800: 'color-mix(in srgb, var(--color-secondary, #0f172a) 90%, black)',
          900: 'color-mix(in srgb, var(--color-secondary, #0f172a) 95%, black)',
        },
        brand: {
          primary: 'var(--color-primary, #4f46e5)',
          secondary: 'var(--color-secondary, #0f172a)',
        }
      }
    },
  },

  plugins: [],
}
