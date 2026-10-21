import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource/sarabun/400.css'
import '@fontsource/sarabun/600.css'
import '@fontsource/prompt/500.css'
import '@fontsource/prompt/600.css'
import App from './App'
import { ToastProvider } from './ui'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <ToastProvider>
      <App />
    </ToastProvider>
  </HashRouter>
)
