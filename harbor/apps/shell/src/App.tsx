import { useEffect } from 'react'
import { ToastViewport } from '@harbor/ui'
import { auth } from './auth.ts'
import { loadDirectory } from './directory.ts'
import { agent, setShortcutHandler } from './interop.ts'
import { shell, useShell } from './state.ts'
import { startSession } from './workspaces/controller.ts'
import { LiveRegion, ShortcutsDialog } from './components/Accessibility.tsx'
import { AlertDrawer } from './components/AlertDrawer.tsx'
import { AppRail } from './components/AppRail.tsx'
import { CommandPalette } from './components/CommandPalette.tsx'
import { IntentResolver } from './components/IntentResolver.tsx'
import { InteropLogDrawer } from './components/InteropLogDrawer.tsx'
import { Layout } from './components/Layout.tsx'
import { Library } from './components/Library.tsx'
import { SignIn } from './components/SignIn.tsx'
import { StatusBar } from './components/StatusBar.tsx'
import { TopBar } from './components/TopBar.tsx'
import { runShortcut, useShellShortcuts } from './shortcuts.ts'

setShortcutHandler(runShortcut)

export function App() {
  const user = useShell((s) => s.user)
  const theme = useShell((s) => s.theme)
  const density = useShell((s) => s.density)
  const directoryLoaded = useShell((s) => s.directoryLoaded)
  const connected = useShell((s) => s.connected)

  useEffect(() => {
    void loadDirectory().then(() => {
      const remembered = auth.current()
      if (remembered && !shell.get().user) void startSession(remembered)
    })
  }, [])

  // Theme and density are attributes on the root; apps get the same values through the agent.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.density = density
    agent.broadcastAppearance({ theme, density })
  }, [theme, density])

  // Apps pause their price streams while the (mock) connection is down.
  useEffect(() => {
    agent.broadcastConnection(connected)
  }, [connected])

  useShellShortcuts()

  if (!directoryLoaded) return null
  if (!user) return <SignIn />
  return (
    <div className="hs-shell">
      <TopBar />
      <AppRail />
      {/* Keyed by user so switching user rebuilds the layout engine from scratch. */}
      <Layout key={user.id} />
      <StatusBar />
      <Library />
      <CommandPalette />
      <IntentResolver />
      <InteropLogDrawer />
      <AlertDrawer />
      <ShortcutsDialog />
      <LiveRegion />
      <ToastViewport />
    </div>
  )
}
