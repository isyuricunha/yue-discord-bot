/**
 * Design System Tokens
 * Centralized design tokens for consistent UI
 */

// Spacing
export const SPACING = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '3rem',     // 48px
  '3xl': '4rem',     // 64px
} as const

// Border radius
export const BORDER_RADIUS = {
  none: '0',
  sm: '0.25rem',    // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  full: '9999px',
} as const

// Typography
export const FONT_SIZES = {
  xs: '0.75rem',     // 12px
  sm: '0.875rem',    // 14px
  base: '1rem',      // 16px
  lg: '1.125rem',    // 18px
  xl: '1.25rem',     // 20px
  '2xl': '1.5rem',   // 24px
  '3xl': '1.875rem', // 30px
  '4xl': '2.25rem',  // 36px
  '5xl': '3rem',     // 48px
} as const

export const FONT_WEIGHTS = {
  thin: '100',
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const

// Line heights
export const LINE_HEIGHTS = {
  none: '1',
  tight: '1.25',
  snug: '1.375',
  normal: '1.5',
  relaxed: '1.625',
  loose: '2',
} as const

// Shadows
export const SHADOWS = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
} as const

// Z-index
export const Z_INDEX = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const

// Transitions
export const TRANSITIONS = {
  none: 'none',
  all: 'all',
  colors: 'color, background-color, border-color, text-decoration-color, fill, stroke',
  opacity: 'opacity',
  shadow: 'box-shadow',
  transform: 'transform',
  durations: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
  },
  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const

// Breakpoints (for responsive design)
export const BREAKPOINTS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const

// Component specific tokens
export const COMPONENTS = {
  // Card
  card: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    shadow: SHADOWS.base,
    border: '1px solid hsl(var(--border))',
  },
  // Button
  button: {
    padding: `${SPACING.sm} ${SPACING.md}`,
    borderRadius: BORDER_RADIUS.md,
    fontWeight: FONT_WEIGHTS.medium,
    transition: TRANSITIONS.durations.normal,
  },
  // Input
  input: {
    padding: `${SPACING.sm} ${SPACING.md}`,
    borderRadius: BORDER_RADIUS.md,
    border: '1px solid hsl(var(--border))',
    fontSize: FONT_SIZES.sm,
  },
  // Sidebar
  sidebar: {
    width: {
      expanded: '260px',
      collapsed: '72px',
    },
    transition: TRANSITIONS.durations.normal,
  },
  // Breadcrumb
  breadcrumb: {
    itemPadding: `${SPACING.xs} ${SPACING.sm}`,
    separatorSize: FONT_SIZES.xs,
    fontSize: FONT_SIZES.sm,
  },
} as const

// Semantic colors for states
export const STATE_COLORS = {
  success: {
    bg: 'hsl(var(--success) / 0.1)',
    border: 'hsl(var(--success))',
    text: 'hsl(var(--success-foreground))',
  },
  warning: {
    bg: 'hsl(var(--warning) / 0.1)',
    border: 'hsl(var(--warning))',
    text: 'hsl(var(--warning-foreground))',
  },
  error: {
    bg: 'hsl(var(--destructive) / 0.1)',
    border: 'hsl(var(--destructive))',
    text: 'hsl(var(--destructive-foreground))',
  },
  info: {
    bg: 'hsl(var(--muted) / 0.5)',
    border: 'hsl(var(--border))',
    text: 'hsl(var(--muted-foreground))',
  },
} as const
