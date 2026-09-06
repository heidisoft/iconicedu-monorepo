/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '../../packages/ui-native/src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          subtle: 'var(--primary-subtle)',
        },
        action: {
          DEFAULT: 'var(--action)',
          foreground: 'var(--action-foreground)',
          subtle: 'var(--action-subtle)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          foreground: 'var(--ink-foreground)',
          subtle: 'var(--ink-subtle)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        success: {
          DEFAULT: 'var(--success)',
          foreground: 'var(--success-foreground)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          foreground: 'var(--warning-foreground)',
        },
        info: {
          DEFAULT: 'var(--info)',
          foreground: 'var(--info-foreground)',
        },
        'accent-pink': {
          DEFAULT: 'var(--accent-pink)',
          foreground: 'var(--accent-pink-foreground)',
        },
        'accent-peach': {
          DEFAULT: 'var(--accent-peach)',
          foreground: 'var(--accent-peach-foreground)',
        },
        'accent-periwinkle': {
          DEFAULT: 'var(--accent-periwinkle)',
          foreground: 'var(--accent-periwinkle-foreground)',
        },
        'accent-lime': {
          DEFAULT: 'var(--accent-lime)',
          foreground: 'var(--accent-lime-foreground)',
        },
        'accent-coral': {
          DEFAULT: 'var(--accent-coral)',
          foreground: 'var(--accent-coral-foreground)',
        },
      },
      borderRadius: {
        xl: 12,
        '2xl': 16,
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
