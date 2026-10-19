import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { SesionProvider } from './lib/sesion'
import App from './App'
import './index.css'
import { aplicarTema, seguirSistema } from './lib/tema'

aplicarTema()
seguirSistema()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SesionProvider>
        <App />
      </SesionProvider>
    </BrowserRouter>
  </StrictMode>,
)
