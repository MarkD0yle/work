import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LoadingGate } from './components/LoadingGate.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LoadingGate>
      <App />
    </LoadingGate>
  </StrictMode>,
)
