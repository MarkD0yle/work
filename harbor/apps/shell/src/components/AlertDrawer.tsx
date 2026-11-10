import { useState, useSyncExternalStore } from 'react'
import { SEVERITIES, type Alert, type Severity } from '@harbor/schemas'
import { Badge, Button, Drawer, EmptyState, Icon, Select, Tabs, type IconName } from '@harbor/ui'
import { alerts } from '../alerts/center.ts'
import { download } from '../download.ts'
import { actOnAlert } from '../interop.ts'
import { shell, useShell } from '../state.ts'

/* Severity is never colour alone: each level has its own icon and a text label. */
export const SEVERITY_ICON: Record<Severity, IconName> = { critical: 'critical', warning: 'warning', info: 'info' }
export const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Critical', warning: 'Warning', info: 'Info' }
const STATUS_LABEL: Record<Alert['status'], string> = { unread: 'New', read: 'Seen', actioned: 'Actioned', dismissed: 'Dismissed' }

type Filter = Severity | 'all'

/** The alert centre: grouped by severity then time, filter by app, act or dismiss, bulk dismiss. */
export function AlertDrawer() {
  const open = useShell((s) => s.alertsOpen)
  const severity = useShell((s) => s.alertSeverity)
  const directory = useShell((s) => s.directory)
  const all = useSyncExternalStore(
    (listener) => alerts.subscribe(listener),
    () => alerts.list(),
  )
  const [appId, setAppId] = useState('all')
  if (!open) return null

  const titleOf = (id: string) => directory.find((r) => r.appId === id)?.title ?? id
  const current = all.filter((a) => a.status !== 'dismissed')
  const shown = current.filter((a) => (severity === null || a.severity === severity) && (appId === 'all' || a.sourceAppId === appId))
  const sources = [...new Set(current.map((a) => a.sourceAppId))].sort()
  const count = (s: Severity) => current.filter((a) => a.severity === s).length
  const close = () => {
    // Everything that was on screen has now been seen.
    alerts.markRead(shown.map((a) => a.id))
    shell.set({ alertsOpen: false })
  }

  return (
    <Drawer
      open
      onClose={close}
      title="Alerts"
      footer={
        <>
          <Button icon="download" onClick={() => download('harbor-alerts.json', alerts.exportJson())}>
            Export history
          </Button>
          <Button disabled={shown.length === 0} onClick={() => alerts.dismiss(shown.map((a) => a.id))}>
            Dismiss {shown.length === current.length ? 'all' : 'these'} ({shown.length})
          </Button>
        </>
      }
    >
      <div className="hs-alerts__filters">
        <Tabs<Filter>
          label="Severity"
          value={severity ?? 'all'}
          onChange={(value) => shell.set({ alertSeverity: value === 'all' ? null : value })}
          items={[{ id: 'all', label: 'All', count: current.length }, ...SEVERITIES.map((s) => ({ id: s, label: SEVERITY_LABEL[s], count: count(s) }))]}
        />
        <Select label="Source app" hideLabel value={appId} onChange={(e) => setAppId(e.target.value)} options={[{ value: 'all', label: 'All apps' }, ...sources.map((id) => ({ value: id, label: titleOf(id) }))]} />
      </div>

      {shown.length === 0 ? (
        <EmptyState icon="bell" title={current.length === 0 ? 'No alerts' : 'No alerts match'} body={current.length === 0 ? 'Apps raise alerts here when something needs attention.' : 'Try another severity or app.'} />
      ) : (
        SEVERITIES.filter((s) => shown.some((a) => a.severity === s)).map((s) => (
          <section key={s} className="hs-alerts__group" aria-label={`${SEVERITY_LABEL[s]} alerts`}>
            <h3 className={`hs-severity hs-severity--${s}`}>
              <Icon name={SEVERITY_ICON[s]} size={14} /> {SEVERITY_LABEL[s]}
            </h3>
            <ul>
              {shown
                .filter((a) => a.severity === s)
                .map((a) => (
                  <li key={a.id} className={`hs-alert hs-alert--${a.severity}${a.status === 'unread' ? ' is-unread' : ''}`} data-testid="alert" data-status={a.status} data-severity={a.severity}>
                    <div className="hs-alert__text">
                      <strong>{a.title}</strong>
                      {a.body && <span>{a.body}</span>}
                      <span className="hs-alert__meta">
                        {titleOf(a.sourceAppId)} · {new Date(a.createdAt).toLocaleTimeString('en-GB')} · <Badge tone={a.status === 'unread' ? 'accent' : a.status === 'actioned' ? 'positive' : 'neutral'}>{STATUS_LABEL[a.status]}</Badge>
                      </span>
                    </div>
                    <div className="hs-alert__actions">
                      {a.action && (
                        <Button variant="primary" disabled={a.status === 'actioned'} onClick={() => void actOnAlert(a.id)}>
                          {a.action.label}
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => alerts.dismiss([a.id])}>
                        Dismiss
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </Drawer>
  )
}
