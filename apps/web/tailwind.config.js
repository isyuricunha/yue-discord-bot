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
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 220ms cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [],
}
