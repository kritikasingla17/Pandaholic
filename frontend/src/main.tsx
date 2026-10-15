import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { missingSupabaseEnvVars } from './lib/config'
import AppErrorBoundary from './components/AppErrorBoundary'
import AppCrashPage from './pages/AppCrashPage'
import ConfigErrorPage from './pages/ConfigErrorPage'

const root = createRoot(document.getElementById('root')!)

if (missingSupabaseEnvVars.length > 0) {
  root.render(
    <StrictMode>
      <ConfigErrorPage missing={missingSupabaseEnvVars} />
    </StrictMode>,
  )
} else {
  // Imported only once the settings exist, because loading App creates the Supabase client.
  import('./App.tsx')
    .then(({ default: App }) => {
      root.render(
        <StrictMode>
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
        </StrictMode>,
      )
    })
    .catch((err: unknown) => {
      console.error('Failed to load the app:', err)
      root.render(
        <StrictMode>
          <AppCrashPage />
        </StrictMode>,
      )
    })
}
