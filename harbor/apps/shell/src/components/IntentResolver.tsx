import { useState } from 'react'
import { Checkbox, Dialog } from '@harbor/ui'
import { useShell } from '../state.ts'
import { AppGlyph } from './AppGlyph.tsx'

/** Shown when two or more apps can handle an intent. Candidates are already entitlement-filtered by the agent. */
export function IntentResolver() {
  const resolver = useShell((s) => s.resolver)
  const [remember, setRemember] = useState(false)
  if (!resolver) return null
  const { request, settle } = resolver
  const subject = typeof request.context.name === 'string' ? request.context.name : request.context.type
  const done = (appId: string | null) => {
    settle(appId ? { appId, remember } : null)
    setRemember(false)
  }
  return (
    <Dialog open onClose={() => done(null)} title={`Open "${request.intent}" with…`}>
      <p className="hs-resolver__subject">
        {request.candidates.length} apps can handle this for <strong>{subject}</strong>.
      </p>
      <ul className="hs-resolver__list">
        {request.candidates.map((app) => (
          <li key={app.appId}>
            <button type="button" className="hs-resolver__option" data-app={app.appId} onClick={() => done(app.appId)}>
              <AppGlyph app={app} />
              <span>
                <strong>{app.title}</strong>
                <span>
                  {app.publisher} · {app.description}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Checkbox label="Remember my choice for this intent" checked={remember} onChange={setRemember} />
    </Dialog>
  )
}
