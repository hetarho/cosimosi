import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { defaultThemeKey } from '@cosimosi/ui'

import App from './app/App.tsx'
import './app/styles/index.css'

// Apply the active theme at the composition boundary. `data-theme` on the root element re-skins
// portalled chrome (dialogs, toasts, tooltips) along with the page, and it reads from the registry
// rather than a literal — switching universes is one edit in @cosimosi/ui's palette.
document.documentElement.dataset.theme = defaultThemeKey

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
