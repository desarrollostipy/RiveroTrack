import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { SesionProvider } from './lib/sesion'
import App from './App'
import './index.css'
import { aplicarTema, seguirSistema } from './lib/tema'
import { vigilarVersion } from './lib/version'
import { ErrorPantalla } from './components/ErrorPantalla'

aplicarTema()
seguirSistema()
vigilarVersion()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorPantalla>
      <BrowserRouter>
        <SesionProvider>
          <App />
        </SesionProvider>
      </BrowserRouter>
    </ErrorPantalla>
  </StrictMode>,
)
