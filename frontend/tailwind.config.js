/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          dark: '#0B1221',
          darker: '#060a12',
          blue: '#00F0FF',
          purple: '#8A2BE2',
          pink: '#FF1493',
          green: '#00FF88',
        }
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        glow: {
          '0%': { 
            boxShadow: '0 0 5px rgba(0, 240, 255, 0.5), 0 0 10px rgba(138, 43, 226, 0.3)' 
          },
          '100%': { 
            boxShadow: '0 0 20px rgba(0, 240, 255, 0.8), 0 0 30px rgba(138, 43, 226, 0.6)' 
          }
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
}
