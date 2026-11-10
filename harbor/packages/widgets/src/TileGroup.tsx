import { useMemo, type ComponentType } from 'react'
import { ReactGridLayout, WidthProvider, type Layout } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import { EmptyState } from '@harbor/ui'
import { AlertsTile } from './AlertsTile.tsx'
import { OrdersAwaitingTile } from './OrdersAwaitingTile.tsx'
import { CutOffsTile, DayCostTile, RatesTile, UnmatchedTradesTile } from './tiles.tsx'
import type { WidgetProps } from './types.ts'

/** Tiles, keyed by App Directory id, with their default size in grid cells. */
export const TILES: Record<string, { component: ComponentType<WidgetProps>; w: number; h: number }> = {
  'tile-orders-awaiting': { component: OrdersAwaitingTile, w: 3, h: 3 },
  'tile-alerts': { component: AlertsTile, w: 3, h: 3 },
  'tile-unmatched': { component: UnmatchedTradesTile, w: 3, h: 3 },
  'tile-day-cost': { component: DayCostTile, w: 3, h: 3 },
  'tile-cutoffs': { component: CutOffsTile, w: 4, h: 4 },
  'tile-rates': { component: RatesTile, w: 5, h: 6 },
}

const COLUMNS = 12
const Grid = WidthProvider(ReactGridLayout)

interface Cell {
  i: string
  x: number
  y: number
  w: number
  h: number
}
const cells = (layout: Layout): Cell[] => layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })).sort((a, b) => a.i.localeCompare(b.i))

/** Pack tiles left to right, wrapping rows, so the default needs no compaction. */
function defaultLayout(ids: string[]): Cell[] {
  let x = 0
  let y = 0
  let rowHeight = 0
  return ids.map((id) => {
    const size = TILES[id] ?? { w: 3, h: 3 }
    if (x + size.w > COLUMNS) {
      x = 0
      y += rowHeight
      rowHeight = 0
    }
    const cell = { i: id, x, y, w: size.w, h: size.h }
    x += size.w
    rowHeight = Math.max(rowHeight, size.h)
    return cell
  })
}

const isCell = (value: unknown): value is Cell =>
  typeof value === 'object' && value !== null && typeof (value as Cell).i === 'string' && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite((value as Record<string, unknown>)[k]))

/**
 * A panel of tiles on a draggable, resizable grid. Which tiles and where is
 * per-placement config (`{ tiles, layout }`), so the same tile can sit in
 * many workspaces arranged differently.
 */
export function TileGroup({ client, config, onConfigChange, canUse }: WidgetProps) {
  const ids = useMemo(
    () => (Array.isArray(config.tiles) ? [...new Set(config.tiles.filter((id): id is string => typeof id === 'string' && id in TILES))] : []).filter((id) => canUse?.(id) ?? true),
    [config.tiles, canUse],
  )
  const layout = useMemo(() => {
    const saved = Array.isArray(config.layout) ? config.layout.filter(isCell).filter((c) => ids.includes(c.i)) : []
    const placed = new Set(saved.map((c) => c.i))
    // Tiles added since the layout was saved go underneath it.
    const bottom = saved.reduce((max, c) => Math.max(max, c.y + c.h), 0)
    return [...saved, ...defaultLayout(ids.filter((id) => !placed.has(id))).map((c) => ({ ...c, y: c.y + bottom }))]
  }, [config.layout, ids])

  if (ids.length === 0) return <EmptyState icon="grid" title="No tiles here" body="Add tiles from the Tiles tab of the Widget Library." />

  return (
    <div className="hw-tiles" data-testid="tile-group">
      <Grid
        className="hw-tiles__grid"
        layout={layout}
        cols={COLUMNS}
        rowHeight={30}
        margin={[8, 8]}
        containerPadding={[8, 8]}
        draggableHandle=".hw-tiles__handle"
        compactType="vertical"
        onLayoutChange={(next: Layout) => {
          // Only a real rearrangement is saved; the grid also reports its initial layout.
          if (JSON.stringify(cells(next)) !== JSON.stringify(cells(layout))) onConfigChange?.({ ...config, layout: cells(next) })
        }}
      >
        {ids.map((id) => {
          const Tile = (TILES[id] as (typeof TILES)[string]).component
          return (
            <div key={id} className="hw-tiles__item" data-tile={id}>
              <span className="hw-tiles__handle" title="Drag to move" aria-hidden="true">
                ⠿
              </span>
              <Tile client={client} config={config} />
            </div>
          )
        })}
      </Grid>
    </div>
  )
}
