import { z } from 'zod'
import { formatIssues, type ValidationResult } from './context.ts'

const IntentListenerSchema = z.object({
  displayName: z.string().optional(),
  contexts: z.array(z.string()).min(1),
})

/** FDC3 App Directory record shape, plus the Harbor extensions from SPEC 9.5. */
export const DirectoryRecordSchema = z.object({
  appId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'appId must be lower-case kebab'),
  title: z.string().min(1),
  description: z.string().default(''),
  publisher: z.enum(['First-party', 'Partner', 'In-house']),
  category: z.string().min(1),
  type: z.literal('web'),
  details: z.object({ url: z.string().min(1) }),
  icons: z.array(z.object({ src: z.string() })).default([]),
  interop: z
    .object({
      intents: z.object({ listensFor: z.record(z.string(), IntentListenerSchema).default({}) }).default({ listensFor: {} }),
      userChannels: z
        .object({ broadcasts: z.array(z.string()).default([]), listensFor: z.array(z.string()).default([]) })
        .default({ broadcasts: [], listensFor: [] }),
    })
    .default({ intents: { listensFor: {} }, userChannels: { broadcasts: [], listensFor: [] } }),
  // Harbor extensions
  kind: z.enum(['app', 'widget', 'tile']),
  allowedOrigins: z.array(z.string()).default([]),
  requiredEntitlement: z.string().min(1),
  defaultSize: z.object({ width: z.number().positive(), height: z.number().positive() }).optional(),
  /**
   * Load this app even while its panel is behind another tab. By default an
   * iframe is not loaded until its panel is first shown. Set this for apps that
   * must keep up with channel context while hidden (e.g. a trade tracker).
   */
  runsInBackground: z.boolean().default(false),
  /** Short glyph (1–2 letters) used when no icon image is supplied. */
  glyph: z.string().max(2).optional(),
})
export type DirectoryRecord = z.infer<typeof DirectoryRecordSchema>

export interface DirectoryParseResult {
  records: DirectoryRecord[]
  /** One entry per rejected record so a bad record never hides the good ones. */
  errors: { index: number; appId?: string; error: string }[]
}

export function parseDirectory(input: unknown): DirectoryParseResult {
  const list = z.object({ applications: z.array(z.unknown()) }).safeParse(input)
  if (!list.success) return { records: [], errors: [{ index: -1, error: formatIssues(list.error) }] }
  const records: DirectoryRecord[] = []
  const errors: DirectoryParseResult['errors'] = []
  const seen = new Set<string>()
  list.data.applications.forEach((raw, index) => {
    const parsed = DirectoryRecordSchema.safeParse(raw)
    const appId = typeof (raw as { appId?: unknown })?.appId === 'string' ? (raw as { appId: string }).appId : undefined
    if (!parsed.success) {
      errors.push({ index, appId, error: formatIssues(parsed.error) })
      return
    }
    if (seen.has(parsed.data.appId)) {
      errors.push({ index, appId, error: `duplicate appId "${parsed.data.appId}"` })
      return
    }
    if (parsed.data.kind === 'app' && parsed.data.allowedOrigins.length === 0) {
      errors.push({ index, appId, error: 'iframe apps must declare allowedOrigins' })
      return
    }
    seen.add(parsed.data.appId)
    records.push(parsed.data)
  })
  return { records, errors }
}

export function parseDirectoryRecord(input: unknown): ValidationResult<DirectoryRecord> {
  const parsed = DirectoryRecordSchema.safeParse(input)
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: formatIssues(parsed.error) }
}

/** Does this record declare a handler for `intent` with `contextType`? */
export function handlesIntent(record: DirectoryRecord, intent: string, contextType: string): boolean {
  const listener = record.interop.intents.listensFor[intent]
  return listener !== undefined && listener.contexts.includes(contextType)
}
