const color = (name) => `rgb(var(--cursor-rgb-${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: color('background'),
        canvas: color('canvas'),
        window: color('window'),
        sidebar: color('sidebar'),
        surface: color('surface'),
        'surface-raised': color('surface-raised'),
        'surface-hover': color('surface-hover'),
        'surface-active': color('surface-active'),
        card: color('card'),
        panel: color('panel'),
        popover: color('popover'),
        input: color('input'),
        tooltip: color('tooltip'),
        chip: color('chip'),
        foreground: color('foreground'),
        strong: color('strong'),
        border: color('border'),
        accent: {
          DEFAULT: color('accent'),
          foreground: color('accent-foreground'),
          hover: color('accent-hover'),
          active: color('accent-active'),
          soft: 'rgb(var(--cursor-rgb-accent) / 0.18)',
        },
        action: {
          DEFAULT: color('accent'),
          foreground: color('accent-foreground'),
          soft: 'rgb(var(--cursor-rgb-accent) / 0.18)',
        },
        success: {
          DEFAULT: color('success'),
          soft: 'rgb(var(--cursor-rgb-success) / 0.18)',
        },
        agent: {
          DEFAULT: color('agent'),
          soft: 'rgb(var(--cursor-rgb-agent) / 0.18)',
        },
        info: {
          DEFAULT: color('info'),
          hover: color('info-hover'),
          soft: 'rgb(var(--cursor-rgb-info) / 0.18)',
        },
        destructive: {
          DEFAULT: color('danger'),
          soft: 'rgb(var(--cursor-rgb-danger) / 0.18)',
        },
        danger: {
          DEFAULT: color('danger'),
          soft: 'rgb(var(--cursor-rgb-danger) / 0.18)',
        },
        warning: {
          DEFAULT: color('accent'),
          soft: 'rgb(var(--cursor-rgb-accent) / 0.18)',
        },
        'muted-foreground': color('muted'),
        muted: {
          DEFAULT: color('muted'),
          dim: color('dim'),
        },
        green: {
          400: color('success'),
          500: color('success'),
        },
        emerald: {
          400: color('success'),
          500: color('success'),
        },
        purple: {
          400: color('agent'),
          500: color('agent'),
        },
        blue: {
          400: color('info'),
          500: color('info'),
          600: color('info'),
          700: color('info-hover'),
        },
        cyan: {
          400: color('info'),
          500: color('info'),
        },
        red: {
          400: color('danger'),
          500: color('danger'),
        },
        yellow: {
          300: color('accent-hover'),
          400: color('accent-hover'),
          500: color('accent'),
        },
        amber: {
          400: color('accent-hover'),
          500: color('accent'),
        },
        orange: {
          400: color('accent'),
          500: color('accent'),
        },
      },
      borderRadius: {
        xs: 'var(--cursor-radius-xs)',
        sm: 'var(--cursor-radius-sm)',
        md: 'var(--cursor-radius-md)',
        lg: 'var(--cursor-radius-lg)',
        xl: 'var(--cursor-radius-card)',
        '2xl': 'var(--cursor-radius-card)',
        '3xl': 'var(--cursor-radius-xl)',
        button: 'var(--cursor-radius-button)',
        input: 'var(--cursor-radius-input)',
        card: 'var(--cursor-radius-card)',
        modal: 'var(--cursor-radius-modal)',
        popover: 'var(--cursor-radius-popover)',
      },
      boxShadow: {
        cursorSm: 'var(--cursor-shadow-sm)',
        cursorMd: 'var(--cursor-shadow-md)',
        cursorLg: 'var(--cursor-shadow-lg)',
        window: 'var(--cursor-window-shadow)',
        floating: 'var(--cursor-floating-shadow)',
        tooltip: 'var(--cursor-tooltip-shadow)',
        innerBorder: 'var(--cursor-inner-border)',
        focusGlow: 'var(--cursor-focus-glow)',
        yellowGlow: 'var(--cursor-yellow-glow)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(120%)' },
        },
        textShimmer: {
          '0%': { backgroundPosition: '220% 0' },
          '100%': { backgroundPosition: '-220% 0' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 220ms cubic-bezier(0.2, 0, 0, 1)',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
        textShimmer: 'textShimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
