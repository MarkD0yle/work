import { useEffect, useState } from 'react'
import { SEVERITIES, type AlertSummary, type Severity } from '@harbor/schemas'
import { Icon, type IconName } from '@harbor/ui'
import type { WidgetProps } from './types.ts'

const ICON: Record<Severity, IconName> = { critical: 'critical', warning: 'warning', info: 'info' }
const LABEL: Record<Severity, string> = { critical: 'Critical', warning: 'Warning', info: 'Info' }

/** Tile: open alerts per severity, live. Click a count to open the alert drawer filtered to it. */
export function AlertsTile({ client }: WidgetProps) {
  const [summary, setSummary] = useState<AlertSummary>({ info: 0, warning: 0, critical: 0 })
  useEffect(() => {
    let live = true
    const off = client.onAlertSummaryChanged((next) => live && setSummary(next))
    void client.getAlertSummary().then((next) => live && setSummary(next), () => {})
    return () => {
      live = false
      off()
    }
  }, [client])

  return (
    <div className="hw-tile hw-tile--static" data-testid="tile-alerts">
      <span className="hw-tile__label">Alerts</span>
      <div className="hw-alert-counts">
        {SEVERITIES.map((severity) => (
          <button
            key={severity}
            type="button"
            className={`hw-alert-count hw-alert-count--${severity}${summary[severity] > 0 ? ' is-active' : ''}`}
            data-testid={`tile-alerts-${severity}`}
            aria-label={`${summary[severity]} ${LABEL[severity].toLowerCase()} alerts. Show them.`}
            onClick={() => void client.showAlerts(severity).catch(() => {})}
          >
            <span className="hw-alert-count__value">{summary[severity]}</span>
            <span className="hw-alert-count__label">
              <Icon name={ICON[severity]} size={12} /> {LABEL[severity]}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
