/* Typed view of the token names in tokens.css. Values are `var(--…)`
 * references so TS consumers stay theme- and density-aware. */

const v = <N extends string>(name: N) => `var(--${name})` as const

export const tokens = {
  color: {
    canvas: v('color-canvas'),
    surface1: v('color-surface-1'),
    surface2: v('color-surface-2'),
    surface3: v('color-surface-3'),
    border: v('color-border'),
    borderStrong: v('color-border-strong'),
    textPrimary: v('color-text-primary'),
    textSecondary: v('color-text-secondary'),
    textMuted: v('color-text-muted'),
    accent: v('color-accent'),
    focus: v('color-focus'),
    buy: v('color-buy'),
    sell: v('color-sell'),
    positive: v('color-positive'),
    warning: v('color-warning'),
    critical: v('color-critical'),
    info: v('color-info'),
  },
  channel: {
    red: v('color-channel-red'),
    orange: v('color-channel-orange'),
    yellow: v('color-channel-yellow'),
    green: v('color-channel-green'),
    cyan: v('color-channel-cyan'),
    blue: v('color-channel-blue'),
    magenta: v('color-channel-magenta'),
    purple: v('color-channel-purple'),
  },
  gap: { hair: v('gap-hair'), xs: v('gap-xs'), sm: v('gap-sm'), md: v('gap-md'), lg: v('gap-lg'), xl: v('gap-xl'), xxl: v('gap-2xl') },
  text: {
    caption: v('text-caption'),
    small: v('text-small'),
    body: v('text-body'),
    emphasis: v('text-emphasis'),
    title: v('text-title'),
    display: v('text-display'),
  },
  component: {
    topbarHeight: v('topbar-height'),
    statusbarHeight: v('statusbar-height'),
    railWidth: v('rail-width'),
    panelHeaderHeight: v('panel-header-height'),
    gridRowHeight: v('grid-row-height'),
    controlHeight: v('control-height'),
  },
} as const

export type Tokens = typeof tokens
export const THEMES = ['dark', 'light'] as const
export const DENSITIES = ['compact', 'comfortable'] as const
