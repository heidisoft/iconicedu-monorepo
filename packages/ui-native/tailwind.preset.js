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
        page: {
          DEFAULT: 'var(--page-bg)',
        },
        teal: {
          DEFAULT: 'var(--teal)',
          foreground: 'var(--teal-foreground)',
          bg: 'var(--teal-bg)',
        },
        tab: {
          DEFAULT: 'var(--tab-bg)',
          border: 'var(--tab-border)',
          active: 'var(--tab-active)',
          inactive: 'var(--tab-inactive)',
        },
        app: {
          input: 'var(--input-bg)',
          overlay: 'var(--modal-overlay)',
          switchTrackOff: 'var(--switch-track-off)',
        },
        text: {
          muted: 'var(--text-muted)',
          faint: 'var(--text-faint)',
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
      fontFamily: {
        sans: ['Inter', 'System', 'sans-serif'],
        mono: ['Geist Mono', 'Menlo', 'monospace'],
      },
      minHeight: {
        touch: '44px',
        control: '48px',
        'control-lg': '52px',
        cta: '56px',
        'row-compact': '48px',
        row: '56px',
        'row-comfortable': '64px',
        'message-row': '72px',
      },
      height: {
        touch: '44px',
        control: '48px',
        'control-lg': '52px',
        cta: '56px',
        bottomTab: '49px',
      },
      spacing: {
        touch: '44px',
        control: '48px',
        cta: '56px',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
        '3xl': '22px',
        '4xl': '26px',
      },
    },
  },
};
