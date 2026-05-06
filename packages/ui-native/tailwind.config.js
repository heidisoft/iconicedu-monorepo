/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  presets: [require('nativewind/preset'), require('./tailwind.preset')],
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  plugins: [require('tailwindcss-animate')],
};
