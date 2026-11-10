import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'dockview/dist/styles/dockview.css'
import '@harbor/tokens/tokens.css'
import '@harbor/ui/ui.css'
import '@harbor/widgets/widgets.css'
import './shell.css'
import { App } from './App.tsx'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
