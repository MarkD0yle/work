import type { HarborClient } from '@harbor/agent-client'

export interface WidgetProps {
  client: HarborClient
  /** Per-placement settings from the workspace file. */
  config: Record<string, unknown>
  /** Save new per-placement settings (e.g. a rearranged tile grid). */
  onConfigChange?: (config: Record<string, unknown>) => void
  /** May the signed-in user use this directory entry? Lets a tile group hide tiles they are not entitled to. */
  canUse?: (appId: string) => boolean
}

/** App channel that order lists listen on for filter requests (e.g. from a tile). */
export const ORDERS_CHANNEL = 'harbor.orders'
