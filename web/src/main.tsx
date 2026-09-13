import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SystemDialogProvider } from './components/SystemDialog.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { updateDocumentFaviconAndIcons, LOGO_PRESET_IMAGES } from './components/DriveHoraLogo.tsx'
import { getSystemSettings } from './services/settingsService.ts'

// Inicialização imediata do Favicon e Ícones da aplicação conforme a logo configurada
try {
  const initialSettings = getSystemSettings();
  const option = initialSettings.branding?.logoOption || 2;
  const customUrl = initialSettings.branding?.customLogoUrl;
  const initialIcon = (option === 'custom' && customUrl)
    ? customUrl
    : (LOGO_PRESET_IMAGES[option as 1 | 2 | 3] || LOGO_PRESET_IMAGES[2]);
  if (initialIcon) {
    updateDocumentFaviconAndIcons(initialIcon);
  }
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <SystemDialogProvider>
        <App />
      </SystemDialogProvider>
    </ErrorBoundary>
  </StrictMode>,
)
