const color = (name) => `rgb(var(--yu-rgb-${name}) / <alpha-value>)`
const soft = (name, alpha = '0.18') => `rgb(var(--yu-rgb-${name}) / ${alpha})`

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
          soft: soft('accent'),
        },
        action: {
          DEFAULT: color('accent'),
          foreground: color('accent-foreground'),
          soft: soft('accent'),
        },
        success: {
          DEFAULT: color('success'),
          soft: soft('success'),
        },
        agent: {
          DEFAULT: color('agent'),
          soft: soft('agent'),
        },
        info: {
          DEFAULT: color('info'),
          hover: color('info-hover'),
          soft: soft('info'),
        },
        destructive: {
          DEFAULT: color('danger'),
          soft: soft('danger'),
        },
        danger: {
          DEFAULT: color('danger'),
          soft: soft('danger'),
        },
        warning: {
          DEFAULT: color('accent'),
          soft: soft('accent'),
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
        xs: 'var(--yu-radius-xs)',
        sm: 'var(--yu-radius-sm)',
        md: 'var(--yu-radius-md)',
        lg: 'var(--yu-radius-lg)',
        xl: 'var(--yu-radius-card)',
        '2xl': 'var(--yu-radius-xl)',
        '3xl': 'var(--yu-radius-2xl)',
        button: 'var(--yu-radius-button)',
        input: 'var(--yu-radius-input)',
        card: 'var(--yu-radius-card)',
        modal: 'var(--yu-radius-modal)',
        popover: 'var(--yu-radius-popover)',
      },
      boxShadow: {
        cursorSm: 'var(--yu-shadow-sm)',
        cursorMd: 'var(--yu-shadow-md)',
        cursorLg: 'var(--yu-shadow-lg)',
        yudarkSm: 'var(--yu-shadow-sm)',
        yudarkMd: 'var(--yu-shadow-md)',
        yudarkLg: 'var(--yu-shadow-lg)',
        window: 'var(--yu-window-shadow)',
        floating: 'var(--yu-floating-shadow)',
        tooltip: 'var(--yu-tooltip-shadow)',
        innerBorder: 'var(--yu-inner-border)',
        focusGlow: 'var(--yu-focus-glow)',
        yellowGlow: 'var(--yu-accent-glow-shadow)',
        accentGlow: 'var(--yu-accent-glow-shadow)',
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
