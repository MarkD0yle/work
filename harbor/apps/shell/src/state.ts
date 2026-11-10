import { create } from 'zustand'
import type { ResolveRequest } from '@harbor/agent'
import type { Density, DirectoryRecord, PanelRecord, Theme, UserInfo, WorkspaceFile } from '@harbor/schemas'

export type DevPanelState = 'loading' | 'empty' | 'error'
export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'template'

export interface ResolverState {
  request: ResolveRequest
  settle: (choice: { appId: string; remember: boolean } | null) => void
}

export interface ShellState {
  user: UserInfo | null
  theme: Theme
  density: Density
  /** Mock connection flag, toggled from the dev panel to test stale-data states. */
  connected: boolean
  lastUpdated: string
  directory: DirectoryRecord[]
  directoryErrors: string[]
  directoryLoaded: boolean
  /** The signed-in user's saved workspaces. */
  saved: WorkspaceFile[]
  activeId: string | null
  activeName: string
  activeTemplateOf: string | undefined
  /** Panel records of the active workspace, by panel id. */
  panels: Record<string, PanelRecord>
  reloadNonce: Record<string, number>
  devState: Record<string, DevPanelState | undefined>
  saveStatus: SaveStatus
  libraryOpen: boolean
  logOpen: boolean
  railExpanded: boolean
  /** True while a Library card is being dragged, so iframes stop eating drag events. */
  dragging: boolean
  resolver: ResolverState | null
}

const stored = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  const value = localStorage.getItem(key) as T | null
  return value && allowed.includes(value) ? value : fallback
}

export const useShell = create<ShellState>(() => ({
  user: null,
  theme: stored('harbor.theme', ['dark', 'light'] as const, 'dark'),
  density: stored('harbor.density', ['compact', 'comfortable'] as const, 'compact'),
  connected: true,
  lastUpdated: new Date().toISOString(),
  directory: [],
  directoryErrors: [],
  directoryLoaded: false,
  saved: [],
  activeId: null,
  activeName: '',
  activeTemplateOf: undefined,
  panels: {},
  reloadNonce: {},
  devState: {},
  saveStatus: 'saved',
  libraryOpen: false,
  logOpen: false,
  railExpanded: false,
  dragging: false,
  resolver: null,
}))

export const shell = {
  get: useShell.getState,
  set: useShell.setState,
}

export function setTheme(theme: Theme): void {
  localStorage.setItem('harbor.theme', theme)
  shell.set({ theme })
}

export function setDensity(density: Density): void {
  localStorage.setItem('harbor.density', density)
  shell.set({ density })
}

export function setConnected(connected: boolean): void {
  shell.set(connected ? { connected, lastUpdated: new Date().toISOString() } : { connected })
}
