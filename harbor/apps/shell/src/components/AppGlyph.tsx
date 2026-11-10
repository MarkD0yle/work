import type { DirectoryRecord } from '@harbor/schemas'

/** App icon: the directory image when present, otherwise a two-letter glyph. */
export function AppGlyph({ app, running }: { app: Pick<DirectoryRecord, 'title' | 'glyph' | 'icons'> | undefined; running?: boolean }) {
  const src = app?.icons[0]?.src
  return (
    <span className="hs-glyph" aria-hidden="true">
      {src ? <img src={src} alt="" /> : (app?.glyph ?? app?.title.slice(0, 2).toUpperCase() ?? '?')}
      {running && <span className="hs-glyph__dot" />}
    </span>
  )
}
