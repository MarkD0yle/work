import { useEffect } from 'react'
import { ToastViewport } from '@harbor/ui'
import { auth } from './auth.ts'
import { loadDirectory } from './directory.ts'
import { agent } from './interop.ts'
import { shell, useShell } from './state.ts'
import { startSession } from './workspaces/controller.ts'
import { AppRail } from './components/AppRail.tsx'
import { IntentResolver } from './components/IntentResolver.tsx'
import { InteropLogDrawer } from './components/InteropLogDrawer.tsx'
import { Layout } from './components/Layout.tsx'
import { Library } from './components/Library.tsx'
import { SignIn } from './components/SignIn.tsx'
import { StatusBar } from './components/StatusBar.tsx'
import { TopBar } from './components/TopBar.tsx'
import { useShellShortcuts } from './shortcuts.ts'

export function App() {
  const user = useShell((s) => s.user)
  const theme = useShell((s) => s.theme)
  const density = useShell((s) => s.density)
  const directoryLoaded = useShell((s) => s.directoryLoaded)

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
      <IntentResolver />
      <InteropLogDrawer />
      <ToastViewport />
    </div>
  )
}
