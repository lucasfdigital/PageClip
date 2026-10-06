import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { DirectionProvider } from '@/components/foundations/direction/direction'
import '@/styles/globals.css'
import App from './App.jsx'

/**
 * O BoardUI troca de tema pela classe `dark` no <html>.
 * O hub antigo seguia o sistema via CSS, então espelhamos o
 * prefers-color-scheme para a classe — sem dependência nova.
 */
function useSystemTheme() {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => document.documentElement.classList.toggle('dark', query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
}

function Root() {
  useSystemTheme()
  return (
    <DirectionProvider locale="pt-BR">
      <App />
    </DirectionProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
