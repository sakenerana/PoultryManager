import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyUserSettings, loadUserSettings } from './utils/userSettings.ts'
import { AuthProvider } from './context/AuthContext.tsx'
import { registerServiceWorker } from './serviceWorkerRegistration.js'

applyUserSettings(loadUserSettings())
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
