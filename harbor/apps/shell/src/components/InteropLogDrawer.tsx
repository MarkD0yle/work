import { useEffect, useState, useSyncExternalStore } from 'react'
import { Badge, Button, Drawer, EmptyState, Switch } from '@harbor/ui'
import { agent, forceMismatch } from '../interop.ts'
import { audit, setConnected, useShell, shell } from '../state.ts'
import { workspaceStore } from '../workspaces/controller.ts'
import type { QuarantinedFile } from '../workspaces/store.ts'
import { download } from '../download.ts'

const TONE = { broadcast: 'neutral', intent: 'positive', open: 'accent', channel: 'neutral', alert: 'warning', dropped: 'critical', denied: 'critical', error: 'warning' } as const

/** The dev panel: the interop log (which doubles as an audit trail) plus test switches. */
export function InteropLogDrawer() {
  const open = useShell((s) => s.logOpen)
  const connected = useShell((s) => s.connected)
  const user = useShell((s) => s.user)
  const entries = useSyncExternalStore(
    (listener) => agent.log.subscribe(listener),
    () => agent.log.entries(),
  )
  const [quarantined, setQuarantined] = useState<QuarantinedFile[]>([])
  useEffect(() => {
    if (open && user) void workspaceStore.listQuarantined(user.id).then(setQuarantined)
  }, [open, user])

  return (
    <Drawer
      open={open}
      onClose={() => shell.set({ logOpen: false })}
      title="Interop log"
      footer={
        <>
          {quarantined.length > 0 && (
            <Button icon="download" onClick={() => download('harbor-quarantined-workspaces.json', JSON.stringify(quarantined, null, 2))}>
              Export {quarantined.length} damaged workspace{quarantined.length === 1 ? '' : 's'}
            </Button>
          )}
          <Button icon="download" onClick={() => download('harbor-audit-trail.json', audit.exportJson())}>
            Export audit trail
          </Button>
          <Button icon="download" onClick={() => download('harbor-interop-log.json', agent.log.exportJson())}>
            Export JSON
          </Button>
        </>
      }
    >
      <div className="hs-log__tools">
        <Switch label="Simulate disconnect" checked={!connected} onChange={(off) => setConnected(!off)} />
        {import.meta.env.DEV && (
          <Button
            onClick={() => {
              shell.set({ logOpen: false })
              void forceMismatch()
            }}
          >
            Force a mismatch
          </Button>
        )}
        <span>{entries.length} entries · append-only</span>
      </div>
      {entries.length === 0 ? (
        <EmptyState title="No interop yet" body="Every broadcast, intent, open and refused message is recorded here." />
      ) : (
        <table className="hs-log" data-testid="interop-log">
          <thead>
            <tr>
              <th>Time</th>
              <th>Kind</th>
              <th>From</th>
              <th>To</th>
              <th>Type</th>
              <th>Id</th>
              <th>Detail</th>
              <th>User</th>
            </tr>
          </thead>
          <tbody>
            {[...entries].reverse().map((e) => (
              <tr key={e.seq} data-kind={e.kind}>
                <td>{e.time.slice(11, 23)}</td>
                <td>
                  <Badge tone={TONE[e.kind]}>{e.kind}</Badge>
                </td>
                <td>{e.from}</td>
                <td>{e.to}</td>
                <td>{e.type}</td>
                <td>{e.id}</td>
                <td>{e.detail ?? ''}</td>
                <td>{e.userId ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Drawer>
  )
}
