import { useEffect, useState } from 'react'
import { USER_CHANNELS } from '@harbor/schemas'
import { ChannelDot } from '@harbor/ui'
import { shell, useShell } from '../state.ts'
import { channelUsage } from '../workspaces/controller.ts'

const nyTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
const SAVE_LABEL = { saved: 'All changes saved', unsaved: 'Unsaved changes', saving: 'Saving…', template: 'Role default (read-only until edited)' } as const

export function StatusBar() {
  const connected = useShell((s) => s.connected)
  const saveStatus = useShell((s) => s.saveStatus)
  const panels = useShell((s) => s.panels)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  const usage = channelUsage(panels)

  return (
    <footer className="hs-statusbar" data-region="statusbar">
      <span className={connected ? 'hs-status-ok' : 'hs-status-bad'} role="status">
        {connected ? '● Connected' : '▲ Disconnected'}
      </span>
      <span>{nyTime.format(now)} NY</span>
      <span>
        env <span className="hs-mock">MOCK</span>
      </span>
      <span data-testid="save-status">{SAVE_LABEL[saveStatus]}</span>
      <button type="button" className="hs-statusbar__button" onClick={() => shell.set({ logOpen: true })}>
        Interop log
      </button>
      <span className="hs-statusbar__spacer" />
      <ul className="hs-legend" aria-label="Channel legend">
        {USER_CHANNELS.map((c) => (
          <li key={c.id} title={`${c.displayMetadata.name}: ${usage[c.id] ?? 0} linked`} className={usage[c.id] ? '' : 'is-unused'}>
            <ChannelDot channelId={c.id} />
            <span className="hb-sr-only">{c.displayMetadata.name}</span>
            <span>{usage[c.id] ?? 0}</span>
          </li>
        ))}
      </ul>
    </footer>
  )
}
