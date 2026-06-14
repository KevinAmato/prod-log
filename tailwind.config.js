/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Warm, editorial neutral palette — deliberately not the generic
        // dashboard look. Diligence is a ledger, not a SaaS console.
        ink: '#1c1a17',
        paper: '#f6f4ef',
        accent: '#b5562e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
