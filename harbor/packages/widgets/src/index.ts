import type { ComponentType } from 'react'
import type { HarborClient } from '@harbor/agent-client'
import { InteropProbe } from './InteropProbe.tsx'

export interface WidgetProps {
  client: HarborClient
  /** Per-placement settings from the workspace file. */
  config: Record<string, unknown>
}

/** In-process widgets and tiles, keyed by App Directory id. */
export const WIDGETS: Record<string, ComponentType<WidgetProps>> = {
  'context-inspector': InteropProbe,
}

export { InteropProbe }
