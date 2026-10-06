import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DirectionProvider } from '@/components/foundations/direction/direction'
import '@/styles/globals.css'
import App from './App.jsx'

/**
 * O hub é sempre light: o BoardUI só escurece com a classe `dark` no <html>,
 * e aqui ela nunca é aplicada.
 */
function Root() {
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
