import type { ComponentType } from 'react'
import { InteropProbe } from './InteropProbe.tsx'
import { MockDataInspector } from './MockDataInspector.tsx'
import { OrderBlotter } from './OrderBlotter.tsx'
import { TILES, TileGroup } from './TileGroup.tsx'
import { UiGallery } from './UiGallery.tsx'
import type { WidgetProps } from './types.ts'

/** In-process widgets and tiles, keyed by App Directory id. */
export const WIDGETS: Record<string, ComponentType<WidgetProps>> = {
  'context-inspector': InteropProbe,
  'mock-data': MockDataInspector,
  'order-blotter': OrderBlotter,
  'tile-group': TileGroup,
  'ui-gallery': UiGallery,
  // A tile opened on its own (not in a group) still works as a panel.
  ...Object.fromEntries(Object.entries(TILES).map(([id, tile]) => [id, tile.component])),
}

export { InteropProbe }
export { ORDERS_CHANNEL, type WidgetProps } from './types.ts'
