/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '../../packages/ui-native/src/**/*.{ts,tsx}',
  ],
  presets: [
    require('nativewind/preset'),
    require('../../packages/ui-native/tailwind.preset'),
  ],
  plugins: [require('tailwindcss-animate')],
};
