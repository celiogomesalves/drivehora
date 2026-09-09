import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SystemDialogProvider } from './components/SystemDialog.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemDialogProvider>
      <App />
    </SystemDialogProvider>
  </StrictMode>,
)
