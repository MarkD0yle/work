import { z } from 'zod'
import { formatIssues, type ValidationResult } from './context.ts'

export const WORKSPACE_SCHEMA_VERSION = 1

export const PanelRecordSchema = z.object({
  panelId: z.string().min(1),
  kind: z.enum(['app', 'widget', 'tileGroup']),
  appId: z.string().min(1),
  channelId: z.string().nullable(),
  config: z.record(z.string(), z.unknown()),
  state: z.record(z.string(), z.unknown()).optional(),
})
export type PanelRecord = z.infer<typeof PanelRecordSchema>

export const WorkspaceFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    name: z.string().min(1).max(80),
    ownerId: z.string().min(1),
    templateOf: z.string().optional(),
    updatedAt: z.string().datetime(),
    /** Dockview serialised layout. Opaque to Harbor; `null` means "not laid out yet". */
    layout: z.unknown(),
    panels: z.array(PanelRecordSchema),
  })
  .refine((w) => new Set(w.panels.map((p) => p.panelId)).size === w.panels.length, {
    message: 'panelId values must be unique',
    path: ['panels'],
  })
export type WorkspaceFile = z.infer<typeof WorkspaceFileSchema>

/**
 * One migration per schema version: `MIGRATIONS[n]` upgrades a version-n file
 * to version n+1. There is nothing older than v1 yet, so the table is empty,
 * but the loop below is the single place every load passes through.
 */
const MIGRATIONS: Record<number, (file: Record<string, unknown>) => Record<string, unknown>> = {}

/** Parse, migrate and validate an unknown value as a workspace file. */
export function migrateWorkspace(input: unknown): ValidationResult<WorkspaceFile> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'Not a workspace file: expected a JSON object.' }
  }
  let file = input as Record<string, unknown>
  const version = file.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { ok: false, error: 'Not a workspace file: schemaVersion is missing.' }
  }
  if (version > WORKSPACE_SCHEMA_VERSION || version < 1) {
    return {
      ok: false,
      error: `Workspace schema version ${version} is not supported (this build reads up to version ${WORKSPACE_SCHEMA_VERSION}).`,
    }
  }
  for (let v = version; v < WORKSPACE_SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v]
    if (!step) return { ok: false, error: `No migration from workspace schema version ${v}.` }
    file = step(file)
  }
  const parsed = WorkspaceFileSchema.safeParse(file)
  if (!parsed.success) return { ok: false, error: `Invalid workspace file: ${formatIssues(parsed.error)}` }
  return { ok: true, value: parsed.data }
}
