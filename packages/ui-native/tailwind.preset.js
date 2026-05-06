/** @type {import('tailwindcss').Config} */
module.exports = {
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
      },
      fontSize: {
        caption: ['11px', { lineHeight: '16px' }],
        meta: ['13px', { lineHeight: '18px' }],
        body: ['16px', { lineHeight: '24px' }],
        'body-lg': ['17px', { lineHeight: '24px' }],
        headline: ['18px', { lineHeight: '26px' }],
        title: ['20px', { lineHeight: '28px' }],
        'title-lg': ['24px', { lineHeight: '32px' }],
      },
      minHeight: {
        touch: '44px',
        control: '48px',
        cta: '56px',
        'row-compact': '48px',
        row: '56px',
        'row-comfortable': '64px',
        'message-row': '72px',
      },
      height: {
        touch: '44px',
        control: '48px',
        cta: '56px',
        bottomTab: '49px',
      },
      spacing: {
        touch: '44px',
        control: '48px',
        cta: '56px',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '16px',
      },
    },
  },
};
