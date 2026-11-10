import type { DockviewApi, DockviewGroupPanel, SerializedDockview } from 'dockview'
import { canLaunch, type DirectoryRecord, type PanelRecord, type UserInfo, type WorkspaceFile } from '@harbor/schemas'
import { toast } from '@harbor/ui'
import { audit, shell } from '../state.ts'
import { BackedWorkspaceStore, IndexedDbBackend, parseWorkspaceJson, type WorkspaceStore } from './store.ts'
import { TEMPLATES, isTemplateId, materialise, templateForRole } from './templates.ts'

export const workspaceStore: WorkspaceStore = new BackedWorkspaceStore(new IndexedDbBackend())

const AUTOSAVE_MS = 500
const PANEL_COMPONENT = 'panel'
const TILE_GROUP = 'tile-group'

let api: DockviewApi | null = null
let current: WorkspaceFile | null = null
/** True while a layout is being applied, so our own changes are not mistaken for edits. */
let applying = false
let lastSnapshot = ''
let lastResizeAt = 0
let saveTimer: ReturnType<typeof setTimeout> | undefined
let disposeLayoutListener: (() => void) | undefined

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    lastResizeAt = Date.now()
  })
}

const lastActiveKey = (userId: string) => `harbor.activeWorkspace.${userId}`
const record = (appId: string): DirectoryRecord | undefined => shell.get().directory.find((r) => r.appId === appId)
const panelKind = (r: DirectoryRecord): PanelRecord['kind'] => (r.kind === 'app' ? 'app' : r.kind === 'widget' ? 'widget' : 'tileGroup')
const titleFor = (appId: string) => record(appId)?.title ?? appId
const canLaunchId = (appId: string, user: UserInfo) => {
  const r = record(appId)
  return r !== undefined && canLaunch(user, r)
}
const requireUser = (): UserInfo => {
  const user = shell.get().user
  if (!user) throw new Error('No user is signed in')
  return user
}

/* ---------- listing ---------- */

export interface WorkspaceEntry {
  id: string
  name: string
  isTemplate: boolean
}

/** Saved workspaces plus the role template, unless the user has already forked it. */
export function workspaceEntries(): WorkspaceEntry[] {
  const { saved, user } = shell.get()
  if (!user) return []
  const entries: WorkspaceEntry[] = saved.map((w) => ({ id: w.id, name: w.name, isTemplate: false }))
  const template = templateForRole(user.role)
  if (!saved.some((w) => w.templateOf === template.id)) entries.unshift({ id: template.id, name: template.name, isTemplate: true })
  return entries
}

async function refreshSaved(): Promise<WorkspaceFile[]> {
  const saved = await workspaceStore.list(requireUser().id)
  shell.set({ saved })
  return saved
}

/* ---------- session ---------- */

export async function startSession(user: UserInfo): Promise<void> {
  shell.set({ user, saved: [], panels: {}, activeId: null })
  audit.record('session.start', user.displayName, null, { role: user.role })
  const saved = await refreshSaved()
  const template = templateForRole(user.role)
  const lastId = localStorage.getItem(lastActiveKey(user.id))
  const target = saved.find((w) => w.id === lastId) ?? saved.find((w) => w.templateOf === template.id)
  await openWorkspace(target?.id ?? template.id)
}

export async function endSession(): Promise<void> {
  await saveNow()
  current = null
  audit.record('session.end', shell.get().user?.displayName ?? '', { role: shell.get().user?.role }, null)
  shell.set({ user: null, saved: [], panels: {}, activeId: null, libraryOpen: false, logOpen: false, alertsOpen: false, alertSeverity: null })
}

/* ---------- layout engine binding ---------- */

export function attachLayout(dockview: DockviewApi): () => void {
  api = dockview
  const subscription = dockview.onDidLayoutChange(() => {
    // Window resizes rescale every panel; that is not a user edit.
    if (applying || Date.now() - lastResizeAt < 400) return
    scheduleSave()
  })
  const removal = dockview.onDidRemovePanel((panel) => {
    if (applying || !shell.get().panels[panel.id]) return
    const { [panel.id]: _removed, ...rest } = shell.get().panels
    shell.set({ panels: rest })
  })
  disposeLayoutListener = () => {
    subscription.dispose()
    removal.dispose()
  }
  if (current) applyLayout(current)
  return () => {
    disposeLayoutListener?.()
    if (api === dockview) api = null
  }
}

function addDockPanel(
  panel: PanelRecord,
  position?: { referencePanel?: string; referenceGroup?: DockviewGroupPanel; direction: 'right' | 'below' | 'within' | 'left' | 'above' },
  initialHeight?: number,
): void {
  if (!api) return
  api.addPanel({ id: panel.panelId, component: PANEL_COMPONENT, title: titleFor(panel.appId), ...(position ? { position } : {}), ...(initialHeight ? { initialHeight } : {}) })
}

/** "Best free slot": split the largest group along its longer side. */
function bestSlot(): { referenceGroup: DockviewGroupPanel; direction: 'right' | 'below' } | undefined {
  const groups = api?.groups.filter((g) => g.api.location.type === 'grid') ?? []
  const largest = [...groups].sort((a, b) => b.width * b.height - a.width * a.height)[0]
  if (!largest) return undefined
  return { referenceGroup: largest, direction: largest.width >= largest.height * 1.2 ? 'right' : 'below' }
}

function snapshot(): string {
  if (!api) return ''
  const { panels, activeName } = shell.get()
  // Which panel has focus is not an edit: clicking inside a panel must not fork a template.
  return JSON.stringify({ name: activeName, layout: api.toJSON(), panels }, (key, value: unknown) => (key === 'activeGroup' || key === 'activeView' ? undefined : value))
}

function applyLayout(file: WorkspaceFile): void {
  if (!api) return
  applying = true
  try {
    if (file.layout) {
      api.fromJSON(file.layout as SerializedDockview)
    } else {
      api.clear()
      const template = TEMPLATES.find((t) => t.id === file.id || t.id === file.templateOf)
      for (const panel of file.panels) {
        const place = template?.panels.find((p) => p.panelId === panel.panelId)?.place
        const anchored = place && api.getPanel(place.ref)
        addDockPanel(panel, anchored ? { referencePanel: place.ref, direction: place.direction } : bestSlot(), place?.height)
      }
    }
    // Reconcile: every record gets a panel, every panel has a record.
    for (const panel of file.panels) if (!api.getPanel(panel.panelId)) addDockPanel(panel, bestSlot())
    for (const dock of [...api.panels]) if (!file.panels.some((p) => p.panelId === dock.id)) dock.api.close()
    for (const dock of api.panels) dock.api.setTitle(titleFor(shell.get().panels[dock.id]?.appId ?? dock.id))
  } catch (error) {
    void recoverFromCorruptLayout(file, error)
    return
  }
  // Panel contents are drawn in overlays that only move when a panel's size
  // changes. After rebuilding a layout in place they can be left at their old
  // positions, so nudge the size once the new grid exists to make them re-measure.
  requestAnimationFrame(() => {
    if (!api) return
    const { width, height } = api
    api.layout(width, height - 1, true)
    api.layout(width, height, true)
    wakeBackgroundPanels()
  })
  // The engine settles sizes asynchronously; only then is the baseline stable.
  setTimeout(() => {
    lastSnapshot = snapshot()
    applying = false
  }, 150)
}

/**
 * The layout engine does not render a tab's content until it is first shown.
 * Apps marked `runsInBackground` must keep up with their channel while hidden,
 * so show each one for an instant, then put the user's tab and focus back.
 */
function wakeBackgroundPanels(): void {
  if (!api) return
  const focused = api.activePanel
  for (const group of api.groups) {
    const shown = group.activePanel
    const sleepers = group.panels.filter((p) => p !== shown && record(shell.get().panels[p.id]?.appId ?? '')?.runsInBackground)
    if (sleepers.length === 0) continue
    for (const panel of sleepers) panel.api.setActive()
    shown?.api.setActive()
  }
  focused?.api.setActive()
}

/** A layout the engine cannot load: keep the bad file for export and fall back to the role template. */
async function recoverFromCorruptLayout(file: WorkspaceFile, error: unknown): Promise<void> {
  applying = false
  const user = requireUser()
  if (!isTemplateId(file.id)) {
    await workspaceStore.quarantine(user.id, file.id, file, `Layout could not be restored: ${String(error)}`)
    await workspaceStore.delete(user.id, file.id)
    await refreshSaved()
  }
  toast({ tone: 'critical', title: `"${file.name}" could not be restored`, body: 'The default workspace was loaded. The damaged file was kept and can be exported from the dev panel.' })
  const template = templateForRole(user.role)
  if (file.id === template.id) {
    api?.clear()
    return
  }
  setCurrent(materialise(template, user.id))
}

function setCurrent(file: WorkspaceFile): void {
  current = file
  const user = requireUser()
  shell.set({
    activeId: file.id,
    activeName: file.name,
    activeTemplateOf: file.templateOf,
    panels: Object.fromEntries(file.panels.map((p) => [p.panelId, p])),
    devState: {},
    saveStatus: isTemplateId(file.id) ? 'template' : 'saved',
  })
  if (!isTemplateId(file.id)) localStorage.setItem(lastActiveKey(user.id), file.id)
  applyLayout(file)
}

export async function openWorkspace(id: string): Promise<void> {
  await saveNow()
  const user = requireUser()
  const template = TEMPLATES.find((t) => t.id === id)
  const file = template ? materialise(template, user.id) : await workspaceStore.get(user.id, id)
  if (!file) {
    toast({ tone: 'warning', title: 'That workspace no longer exists' })
    return
  }
  setCurrent(file)
}

/* ---------- saving ---------- */

function scheduleSave(): void {
  if (!current) return
  shell.set({ saveStatus: 'unsaved' })
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void saveNow(), AUTOSAVE_MS)
}

function buildFile(overrides: Partial<WorkspaceFile> = {}): WorkspaceFile | null {
  const { user, panels, activeId, activeName, activeTemplateOf } = shell.get()
  if (!api || !user || !activeId) return null
  const present = new Set(api.panels.map((p) => p.id))
  return {
    schemaVersion: 1,
    id: activeId,
    name: activeName,
    ownerId: user.id,
    ...(activeTemplateOf ? { templateOf: activeTemplateOf } : {}),
    updatedAt: new Date().toISOString(),
    layout: api.toJSON(),
    panels: Object.values(panels).filter((p) => present.has(p.panelId)),
    ...overrides,
  }
}

/** Flush pending changes. Editing a read-only template forks it into a saved workspace. */
export async function saveNow(): Promise<void> {
  clearTimeout(saveTimer)
  saveTimer = undefined
  if (!api || !current || applying) return
  const snap = snapshot()
  if (snap === lastSnapshot) {
    if (shell.get().saveStatus === 'unsaved') shell.set({ saveStatus: isTemplateId(current.id) ? 'template' : 'saved' })
    return
  }
  const forking = isTemplateId(current.id)
  const file = buildFile(forking ? { id: crypto.randomUUID(), templateOf: current.id } : {})
  if (!file) return
  shell.set({ saveStatus: 'saving' })
  await workspaceStore.save(file)
  current = file
  lastSnapshot = snap
  shell.set({ activeId: file.id, activeTemplateOf: file.templateOf, saveStatus: 'saved' })
  localStorage.setItem(lastActiveKey(file.ownerId), file.id)
  await refreshSaved()
  if (forking) audit.record('workspace.fork', file.name, { templateOf: file.templateOf }, { id: file.id, panels: file.panels.length })
  if (forking) toast({ tone: 'info', title: `Saved your own copy of "${file.name}"`, body: 'Role defaults are read-only. "Reset to default" restores the original.' })
}

/* ---------- workspace actions ---------- */

async function saveCopy(name: string, source: WorkspaceFile | null): Promise<void> {
  if (!source) return
  const { templateOf: _templateOf, ...rest } = source
  const copy: WorkspaceFile = { ...rest, id: crypto.randomUUID(), name, updatedAt: new Date().toISOString() }
  audit.record('workspace.copy', name, { from: source.name }, { id: copy.id, panels: copy.panels.length })
  await workspaceStore.save(copy)
  await refreshSaved()
  setCurrent(copy)
}

export async function saveWorkspaceAs(name: string): Promise<void> {
  const source = buildFile()
  // Leave the workspace we came from as it was last saved.
  lastSnapshot = snapshot()
  await saveCopy(name, source)
}

export async function duplicateWorkspace(): Promise<void> {
  await saveNow()
  await saveCopy(`${shell.get().activeName} copy`, buildFile())
}

export async function newWorkspace(name: string): Promise<void> {
  await saveNow()
  const user = requireUser()
  const file: WorkspaceFile = { schemaVersion: 1, id: crypto.randomUUID(), name, ownerId: user.id, updatedAt: new Date().toISOString(), layout: null, panels: [] }
  audit.record('workspace.create', name, null, { id: file.id })
  await workspaceStore.save(file)
  await refreshSaved()
  setCurrent(file)
}

export async function renameWorkspace(name: string): Promise<void> {
  audit.record('workspace.rename', shell.get().activeId ?? '', { name: shell.get().activeName }, { name })
  shell.set({ activeName: name })
  await saveNow()
}

export async function deleteWorkspace(): Promise<void> {
  const user = requireUser()
  const { activeId } = shell.get()
  if (!activeId || isTemplateId(activeId)) return
  clearTimeout(saveTimer)
  audit.record('workspace.delete', shell.get().activeName, { id: activeId, panels: Object.keys(shell.get().panels).length }, null)
  await workspaceStore.delete(user.id, activeId)
  localStorage.removeItem(lastActiveKey(user.id))
  current = null
  const saved = await refreshSaved()
  const template = templateForRole(user.role)
  await openWorkspace(saved.find((w) => w.templateOf === template.id)?.id ?? template.id)
}

export function canResetToDefault(): boolean {
  const { activeId, activeTemplateOf } = shell.get()
  return Boolean(activeTemplateOf) && activeId !== null && !isTemplateId(activeId)
}

export async function resetToDefault(): Promise<void> {
  const user = requireUser()
  const { activeId, activeTemplateOf, activeName } = shell.get()
  const template = TEMPLATES.find((t) => t.id === activeTemplateOf)
  if (!activeId || !template) return
  clearTimeout(saveTimer)
  const file: WorkspaceFile = { ...materialise(template, user.id), id: activeId, name: activeName, templateOf: template.id, updatedAt: new Date().toISOString() }
  audit.record('workspace.reset', activeName, { panels: Object.keys(shell.get().panels).length }, { panels: file.panels.length, template: template.id })
  await workspaceStore.save(file)
  setCurrent(file)
  // Persist the rebuilt layout once the engine has settled.
  setTimeout(() => {
    lastSnapshot = ''
    void saveNow()
  }, 300)
}

export async function exportWorkspace(): Promise<{ filename: string; json: string } | null> {
  await saveNow()
  const file = buildFile()
  if (!file) return null
  const slug = file.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'
  return { filename: `${slug}.harbor.json`, json: JSON.stringify(file, null, 2) }
}

export interface ImportPreview {
  json: string
  name: string
  panelCount: number
  /** App ids the file uses that are not in the App Directory. */
  missing: string[]
  /** Apps the file uses that this user may not launch. */
  unentitled: string[]
}

export function previewImport(json: string): { ok: true; preview: ImportPreview } | { ok: false; error: string } {
  const parsed = parseWorkspaceJson(json)
  if (!parsed.ok) return parsed
  const user = requireUser()
  const appIds = [...new Set(parsed.value.panels.map((p) => p.appId))]
  return {
    ok: true,
    preview: {
      json,
      name: parsed.value.name,
      panelCount: parsed.value.panels.length,
      missing: appIds.filter((id) => !record(id)),
      unentitled: appIds.filter((id) => {
        const r = record(id)
        return r !== undefined && !canLaunch(user, r)
      }),
    },
  }
}

export async function importWorkspace(json: string): Promise<void> {
  await saveNow()
  const result = await workspaceStore.import(requireUser().id, json)
  if (!result.ok) {
    toast({ tone: 'critical', title: 'Import failed', body: result.error })
    return
  }
  audit.record('workspace.import', result.value.name, null, { id: result.value.id, panels: result.value.panels.length })
  await refreshSaved()
  setCurrent(result.value)
  toast({ tone: 'positive', title: `Imported "${result.value.name}"` })
}

/* ---------- panel actions ---------- */

const patchPanel = (panelId: string, patch: Partial<PanelRecord>) => {
  const existing = shell.get().panels[panelId]
  if (!existing) return
  shell.set({ panels: { ...shell.get().panels, [panelId]: { ...existing, ...patch } } })
}

export function setPanelChannel(panelId: string, channelId: string | null): void {
  const existing = shell.get().panels[panelId]
  if (!existing || existing.channelId === channelId) return
  audit.record('panel.channel', `${existing.appId} (${panelId})`, { channelId: existing.channelId }, { channelId })
  patchPanel(panelId, { channelId })
  scheduleSave()
}

export interface AddPanelOptions {
  channelId?: string | null
  config?: Record<string, unknown>
  position?: { referenceGroup?: DockviewGroupPanel; referencePanel?: string; direction: 'right' | 'below' | 'within' | 'left' | 'above' }
}

/** Add a panel for a directory app. Refuses apps the user may not launch. */
export function addPanel(appId: string, options: AddPanelOptions = {}): string | null {
  const app = record(appId)
  const user = shell.get().user
  // A tile group is only usable if the group widget itself is too.
  if (!api || !app || !user || !canLaunch(user, app) || (app.kind === 'tile' && !canLaunchId(TILE_GROUP, user))) {
    toast({ tone: 'warning', title: 'That app is not available' })
    return null
  }
  if (app.kind === 'tile') return addTile(app.appId, options)
  const panelId = `${appId}-${crypto.randomUUID().slice(0, 8)}`
  const panel: PanelRecord = { panelId, kind: panelKind(app), appId, channelId: options.channelId ?? null, config: options.config ?? {} }
  audit.record('panel.add', `${appId} (${panelId})`, null, { channelId: panel.channelId })
  shell.set({ panels: { ...shell.get().panels, [panelId]: panel } })
  addDockPanel(panel, options.position ?? bestSlot())
  return panelId
}

/** A tile joins the workspace's tile group. If there is none, a group is created for it. */
function addTile(tileId: string, options: AddPanelOptions): string | null {
  const group = Object.values(shell.get().panels).find((p) => p.appId === TILE_GROUP && api?.getPanel(p.panelId))
  if (group) {
    const tiles = Array.isArray(group.config.tiles) ? (group.config.tiles as unknown[]) : []
    if (tiles.includes(tileId)) toast({ tone: 'info', title: 'That tile is already in this workspace' })
    else setPanelConfig(group.panelId, { ...group.config, tiles: [...tiles, tileId] })
    focusPanel(group.panelId)
    return group.panelId
  }
  if (!record(TILE_GROUP)) return null
  // New groups share the active panel's channel so their tiles see the same context.
  const channelId = shell.get().panels[api?.activePanel?.id ?? '']?.channelId ?? null
  return addPanel(TILE_GROUP, { ...options, channelId, config: { tiles: [tileId] } })
}

/** Focus a running instance of the app, or open one. Returns the panel (instance) id. */
export function focusOrOpen(appId: string, newInstance = false): string {
  if (!newInstance) {
    const existing = api?.panels.find((p) => shell.get().panels[p.id]?.appId === appId)
    if (existing) {
      existing.api.setActive()
      return existing.id
    }
  }
  const panelId = addPanel(appId)
  if (!panelId) throw new Error(`Cannot open ${appId}`)
  return panelId
}

export function focusPanel(panelId: string): void {
  api?.getPanel(panelId)?.api.setActive()
}

/** Save new per-placement settings for a panel (e.g. a rearranged tile grid). */
export function setPanelConfig(panelId: string, config: Record<string, unknown>): void {
  audit.record('panel.config', panelId, shell.get().panels[panelId]?.config, config)
  patchPanel(panelId, { config })
  scheduleSave()
}

export function closePanel(panelId: string): void {
  const closing = shell.get().panels[panelId]
  if (closing) audit.record('panel.close', `${closing.appId} (${panelId})`, { channelId: closing.channelId }, null)
  api?.getPanel(panelId)?.api.close()
  const { [panelId]: _removed, ...rest } = shell.get().panels
  shell.set({ panels: rest })
}

export function duplicatePanel(panelId: string): void {
  const source = shell.get().panels[panelId]
  if (source) addPanel(source.appId, { channelId: source.channelId, config: { ...source.config }, position: { referencePanel: panelId, direction: 'right' } })
}

export function reloadPanel(panelId: string): void {
  const { reloadNonce, devState } = shell.get()
  shell.set({ reloadNonce: { ...reloadNonce, [panelId]: (reloadNonce[panelId] ?? 0) + 1 }, devState: { ...devState, [panelId]: undefined } })
}

export async function movePanelToWorkspace(panelId: string, targetId: string): Promise<void> {
  const user = requireUser()
  const panel = shell.get().panels[panelId]
  const target = await workspaceStore.get(user.id, targetId)
  if (!panel || !target) return
  // The target's layout is opaque to us; it places the new panel when next opened.
  const moved: PanelRecord = { ...panel, panelId: target.panels.some((p) => p.panelId === panelId) ? `${panel.appId}-${crypto.randomUUID().slice(0, 8)}` : panelId }
  await workspaceStore.save({ ...target, panels: [...target.panels, moved], updatedAt: new Date().toISOString() })
  closePanel(panelId)
  await refreshSaved()
  toast({ tone: 'positive', title: `Moved to "${target.name}"` })
}

/** Channel link counts for the status bar legend. */
export function channelUsage(panels: Record<string, PanelRecord>): Record<string, number> {
  const usage: Record<string, number> = {}
  for (const p of Object.values(panels)) if (p.channelId) usage[p.channelId] = (usage[p.channelId] ?? 0) + 1
  return usage
}
