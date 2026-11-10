import { useRef, useState } from 'react'
import { Button, Dialog, Icon, IconButton, Input, Kbd, Menu, toast, type MenuItem } from '@harbor/ui'
import { auth } from '../auth.ts'
import { download } from '../download.ts'
import { setDensity, setTheme, shell, useShell } from '../state.ts'
import {
  canResetToDefault,
  deleteWorkspace,
  duplicateWorkspace,
  endSession,
  exportWorkspace,
  importWorkspace,
  newWorkspace,
  openWorkspace,
  previewImport,
  renameWorkspace,
  resetToDefault,
  saveWorkspaceAs,
  startSession,
  workspaceEntries,
  type ImportPreview,
} from '../workspaces/controller.ts'
import { isTemplateId } from '../workspaces/templates.ts'

type NameAction = { title: string; initial: string; confirm: string; run: (name: string) => Promise<void> }

function NameDialog({ action, onClose }: { action: NameAction; onClose: () => void }) {
  const [name, setName] = useState(action.initial)
  const valid = name.trim().length > 0 && name.trim().length <= 80
  const submit = () => {
    if (!valid) return
    void action.run(name.trim())
    onClose()
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={action.title}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={submit}>
            {action.confirm}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Input label="Workspace name" value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} />
      </form>
    </Dialog>
  )
}

function ImportDialog({ preview, onClose }: { preview: ImportPreview; onClose: () => void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      title="Import workspace"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              void importWorkspace(preview.json)
              onClose()
            }}
          >
            Import
          </Button>
        </>
      }
    >
      <dl className="hs-kv" data-testid="import-preview">
        <dt>Name</dt>
        <dd>{preview.name}</dd>
        <dt>Panels</dt>
        <dd>{preview.panelCount}</dd>
        <dt>Missing apps</dt>
        <dd>{preview.missing.length ? preview.missing.join(', ') : 'None'}</dd>
        <dt>No access</dt>
        <dd>{preview.unentitled.length ? preview.unentitled.join(', ') : 'None'}</dd>
      </dl>
      {(preview.missing.length > 0 || preview.unentitled.length > 0) && <p className="hs-note">Those panels will show a placeholder in their slot.</p>}
    </Dialog>
  )
}

export function TopBar() {
  const user = useShell((s) => s.user)
  const theme = useShell((s) => s.theme)
  const density = useShell((s) => s.density)
  const activeId = useShell((s) => s.activeId)
  const activeName = useShell((s) => s.activeName)
  // Read so the switcher refreshes when saved workspaces change.
  useShell((s) => s.saved)
  useShell((s) => s.activeTemplateOf)
  const [nameAction, setNameAction] = useState<NameAction | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  if (!user) return null

  const isTemplate = activeId !== null && isTemplateId(activeId)
  const workspaceItems: MenuItem[] = [
    ...workspaceEntries().map((w) => ({
      id: w.id,
      label: w.isTemplate ? `${w.name} (default)` : w.name,
      checked: w.id === activeId,
      onSelect: () => void openWorkspace(w.id),
    })),
    { id: 'save-as', label: 'Save as…', separated: true, onSelect: () => setNameAction({ title: 'Save workspace as', initial: `${activeName} copy`, confirm: 'Save', run: saveWorkspaceAs }) },
    { id: 'rename', label: 'Rename…', disabled: isTemplate, onSelect: () => setNameAction({ title: 'Rename workspace', initial: activeName, confirm: 'Rename', run: renameWorkspace }) },
    { id: 'duplicate', label: 'Duplicate', onSelect: () => void duplicateWorkspace() },
    {
      id: 'export',
      label: 'Export…',
      separated: true,
      onSelect: () =>
        void exportWorkspace().then((file) => {
          if (file) download(file.filename, file.json)
        }),
    },
    { id: 'import', label: 'Import…', onSelect: () => fileInput.current?.click() },
    { id: 'reset', label: 'Reset to default', separated: true, disabled: !canResetToDefault(), onSelect: () => void resetToDefault() },
    { id: 'delete', label: 'Delete', danger: true, disabled: isTemplate, onSelect: () => void deleteWorkspace() },
  ]

  const profileItems: MenuItem[] = [
    { id: 'theme-dark', label: 'Dark theme', checked: theme === 'dark', onSelect: () => setTheme('dark') },
    { id: 'theme-light', label: 'Light theme', checked: theme === 'light', onSelect: () => setTheme('light') },
    { id: 'density-compact', label: 'Compact density', checked: density === 'compact', separated: true, onSelect: () => setDensity('compact') },
    { id: 'density-comfortable', label: 'Comfortable density', checked: density === 'comfortable', onSelect: () => setDensity('comfortable') },
    // The user switcher exists in dev builds only.
    ...(import.meta.env.DEV
      ? auth.listUsers().map((u, i) => ({
          id: `switch-${u.id}`,
          label: `Switch to ${u.role}`,
          checked: u.id === user.id,
          separated: i === 0,
          onSelect: () => {
            if (u.id === user.id) return
            void endSession().then(() => startSession(auth.signIn(u.id)))
          },
        }))
      : []),
    {
      id: 'sign-out',
      label: 'Sign out',
      separated: true,
      onSelect: () => {
        auth.signOut()
        void endSession()
      },
    },
  ]

  return (
    <header className="hs-topbar" data-region="topbar">
      <span className="hs-mark">
        <span className="hs-mark__logo" aria-hidden="true" />
        Harbor
      </span>
      <Menu
        label={`Workspace: ${activeName}`}
        triggerClassName="hb-button hb-button--secondary hs-workspace-trigger"
        trigger={
          <>
            <span data-testid="workspace-name">{activeName || 'No workspace'}</span>
            <Icon name="chevronDown" size={14} />
          </>
        }
        items={workspaceItems}
      />
      <IconButton icon="plus" label="New workspace" onClick={() => setNameAction({ title: 'New workspace', initial: 'Untitled workspace', confirm: 'Create', run: newWorkspace })} />
      <span className="hs-topbar__spacer" />
      <button type="button" className="hs-search" onClick={() => shell.set({ libraryOpen: true })}>
        <Icon name="search" size={14} />
        <span>Search apps and workspaces</span>
        <Kbd>⌘K</Kbd>
      </button>
      <span className="hs-topbar__spacer" />
      <IconButton icon="bell" label="Alerts (0 unread)" onClick={() => toast({ title: 'No alerts', body: 'The alert centre arrives in Phase 7.' })} />
      <Menu
        label={`Profile: ${user.displayName}`}
        align="end"
        triggerClassName="hs-profile"
        trigger={
          <>
            <Icon name="user" />
            <span>
              <strong data-testid="user-name">{user.displayName}</strong>
              <span data-testid="user-role">{user.role}</span>
            </span>
          </>
        }
        items={profileItems}
      />
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="hb-sr-only"
        tabIndex={-1}
        aria-label="Workspace file to import"
        data-testid="import-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          void file.text().then((json) => {
            const result = previewImport(json)
            if (result.ok) setPreview(result.preview)
            else toast({ tone: 'critical', title: 'This file cannot be imported', body: result.error })
          })
        }}
      />
      {nameAction && <NameDialog key={nameAction.title} action={nameAction} onClose={() => setNameAction(null)} />}
      {preview && <ImportDialog preview={preview} onClose={() => setPreview(null)} />}
    </header>
  )
}
