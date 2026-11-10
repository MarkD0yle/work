import { StrictMode, createContext, use, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { connect, type HarborClient } from '@harbor/agent-client'
import { EmptyState, ErrorState, Skeleton, ToastViewport } from '@harbor/ui'
import { useSession, type Session } from './hooks.ts'
import { realmServices } from './realm.ts'

export interface AppContextValue extends Session {
  client: HarborClient
}

const AppContext = createContext<AppContextValue | null>(null)

/** The connected client, services, user and connection state. Only valid inside `<HarborApp>`. */
export function useApp(): AppContextValue {
  const value = use(AppContext)
  if (!value) throw new Error('useApp() must be used inside <HarborApp>')
  return value
}

function Connected({ client, children }: { client: HarborClient; children: ReactNode }) {
  const session = useSession(client)
  // An app has the realm to itself, so when its panel is hidden nobody can see its prices: stop delivering them.
  useEffect(() => client.onVisibilityChanged((visible) => realmServices().prices.setSuspended(!visible)), [client])
  if (!session) return <Skeleton />
  return <AppContext value={{ client, ...session }}>{children}</AppContext>
}

/**
 * The frame every iframe app renders inside. It owns the states that are the
 * same for all of them: loading while connecting, an error with Reload if the
 * shell never answers, and a note when opened outside a shell.
 */
export function HarborApp({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<HarborClient | null>(null)
  const [error, setError] = useState<string | null>(null)
  const standalone = window.parent === window

  useEffect(() => {
    if (standalone) return
    let live = true
    connect().then(
      (c) => (live ? setClient(c) : c.close()),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      live = false
    }
  }, [standalone])

  if (standalone) return <EmptyState title="This app runs inside Harbor" body="Open it from the shell's app rail or Widget Library." />
  if (error) return <ErrorState title="Could not connect to the shell" body={error} onReload={() => window.location.reload()} />
  if (!client) return <Skeleton />
  return (
    <>
      <Connected client={client}>{children}</Connected>
      <ToastViewport />
    </>
  )
}

/** Mount an app into `#root`. */
export function mountApp(app: ReactNode): void {
  const root = document.getElementById('root')
  if (!root) return
  createRoot(root).render(
    <StrictMode>
      <HarborApp>{app}</HarborApp>
    </StrictMode>,
  )
}
