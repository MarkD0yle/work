import { useEffect, useRef, useState } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

/** Read token values for the canvas, which cannot use CSS variables itself. */
function palette() {
  const style = getComputedStyle(document.documentElement)
  const token = (name: string) => style.getPropertyValue(name).trim()
  return {
    text: token('--color-text-secondary'),
    grid: token('--color-border'),
    accent: token('--color-accent-text'),
    cost: token('--color-sell'),
    saving: token('--color-buy'),
    highlight: token('--color-warning'),
    font: `${token('--text-caption') || '11px'} ${token('--font-family')}`,
  }
}

/** Bumps whenever the theme or density attribute changes, so charts redraw in the new colours. */
function useAppearanceVersion(): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const observer = new MutationObserver(() => setVersion((v) => v + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-density'] })
    return () => observer.disconnect()
  }, [])
  return version
}

export interface ChartProps {
  /** Accessible summary of what the chart shows; the canvas itself is not readable. */
  label: string
  kind: 'points' | 'bars'
  /** Epoch seconds for `points`; category labels for `bars`. */
  x: number[] | string[]
  y: number[]
  /** Index of a point or bar to pick out. */
  highlight?: number
  height?: number
}

/** A small canvas chart (uPlot). Y is always basis points. */
export function Chart({ label, kind, x, y, highlight, height = 180 }: ChartProps) {
  const host = useRef<HTMLDivElement>(null)
  const appearance = useAppearanceVersion()

  useEffect(() => {
    const el = host.current
    if (!el) return
    const colors = palette()
    const categories = kind === 'bars' ? (x as string[]) : null
    const xs = categories ? categories.map((_, i) => i) : (x as number[])
    const axis = { stroke: colors.text, font: colors.font, grid: { stroke: colors.grid, width: 1 }, ticks: { stroke: colors.grid, width: 1 } }
    const marked = y.map((value, i) => (i === highlight ? value : null))
    const options: uPlot.Options = {
      width: Math.max(160, el.clientWidth),
      height,
      legend: { show: false },
      cursor: { show: false },
      scales: {
        x: categories ? { time: false, range: [-0.6, Math.max(0.6, categories.length - 0.4)] } : { time: true },
        y: { range: (_u, min, max) => [Math.min(0, min) - 0.2, Math.max(0, max) + 0.2] },
      },
      axes: [
        categories ? { ...axis, splits: () => xs, values: (_u, splits) => splits.map((i) => categories[i] ?? '') } : axis,
        { ...axis, size: 44, values: (_u, splits) => splits.map((v) => v.toFixed(1)) },
      ],
      series: [
        {},
        kind === 'bars'
          ? { stroke: colors.accent, fill: colors.accent, paths: uPlot.paths.bars?.({ size: [0.6, 48] }), points: { show: false } }
          : { stroke: colors.accent, paths: () => null, points: { show: true, size: 4, fill: colors.accent, stroke: colors.accent } },
        kind === 'bars'
          ? { stroke: colors.highlight, fill: colors.highlight, paths: uPlot.paths.bars?.({ size: [0.6, 48] }), points: { show: false } }
          : { stroke: colors.highlight, paths: () => null, points: { show: true, size: 10, fill: colors.highlight, stroke: colors.highlight } },
      ],
    }
    const plot = new uPlot(options, [xs, y, marked], el)
    const resize = new ResizeObserver(() => plot.setSize({ width: Math.max(160, el.clientWidth), height }))
    resize.observe(el)
    return () => {
      resize.disconnect()
      plot.destroy()
    }
  }, [kind, x, y, highlight, height, appearance])

  return <div ref={host} className="tc-chart" role="img" aria-label={label} />
}
