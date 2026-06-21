/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Trading terminal color palette
        background: {
          DEFAULT: '#0a0a0f',
          secondary: '#12121a',
          tertiary: '#1a1a25',
          hover: '#22222f',
        },
        surface: {
          DEFAULT: '#15151f',
          secondary: '#1c1c28',
          elevated: '#232330',
        },
        border: {
          DEFAULT: '#2a2a3a',
          subtle: '#1f1f2f',
          active: '#3a3a4f',
        },
        text: {
          primary: '#e8e8ef',
          secondary: '#a0a0b0',
          muted: '#606070',
          inverse: '#0a0a0f',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
          muted: '#4f46e5',
        },
        bull: {
          DEFAULT: '#22c55e',
          muted: '#16a34a',
          dark: '#15803d',
        },
        bear: {
          DEFAULT: '#ef4444',
          muted: '#dc2626',
          dark: '#b91c1c',
        },
        status: {
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444',
          info: '#3b82f6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
