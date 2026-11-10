import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { connect, type HarborClient } from '@harbor/agent-client'
import { EmptyState, ErrorState, Skeleton } from '@harbor/ui'
import { InteropProbe } from '@harbor/widgets'
import '@harbor/tokens/tokens.css'
import '@harbor/ui/ui.css'
import '@harbor/widgets/widgets.css'

/* The interop probe: a dev tool hosted as an ordinary iframe app, on two
 * origins, to exercise the agent. It knows nothing about the shell: identity,
 * user, theme and channel all arrive through the agent client. */
function App() {
  const [client, setClient] = useState<HarborClient | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    connect().then(
      (c) => (live ? setClient(c) : c.close()),
      (e) => live && setError(String(e instanceof Error ? e.message : e)),
    )
    return () => {
      live = false
    }
  }, [])

  if (window.parent === window) return <EmptyState title="This app runs inside Harbor" body="Open it from the shell's app rail or Widget Library." />
  if (error) return <ErrorState title="Could not connect to the shell" body={error} onReload={() => location.reload()} />
  if (!client) return <Skeleton />
  return (
    <div style={{ height: '100%' }}>
      <InteropProbe client={client} />
    </div>
  )
}

const root = document.getElementById('root')
if (root) {
  root.style.height = '100%'
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
