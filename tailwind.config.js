/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        cormorant: ['Cormorant Garamond', 'serif'],
        jost: ['Jost', 'sans-serif'],
      },
      colors: {
        sage: {
          50: '#f4f7f4',
          100: '#e3ebe4',
          200: '#c7d6c9',
          300: '#a3bba6',
          400: '#7e9b82',
          500: '#5f7e63',
          600: '#4a674e',
          700: '#3b5440',
          800: '#304436',
          900: '#28392d',
        },
        clay: {
          50: '#faf6f1',
          100: '#f2e9df',
          200: '#e6d4c3',
          300: '#d4b69e',
          400: '#c09a78',
          500: '#a87e5c',
          600: '#8e6748',
          700: '#73513a',
          800: '#5d4230',
          900: '#4a3526',
        },
        stone: {
          50: '#faf8f5',
          100: '#f5f1ec',
          200: '#ebe4dc',
          300: '#dcd2c7',
          400: '#c4b6a7',
          500: '#a89684',
          600: '#8c7a68',
          700: '#6f5f50',
          800: '#4a3f35',
          900: '#2e261f',
        },
      },
      letterSpacing: {
        'wider-2': '0.2em',
      },
    },
  },
  plugins: [],
};
