import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { DirectionProvider } from '@/components/foundations/direction/direction'
import App from './App.jsx'

/** Gera o HTML do site no build, para buscadores e prévias de link. */
export function render() {
  return renderToString(
    <StrictMode>
      <DirectionProvider locale="pt-BR">
        <App />
      </DirectionProvider>
    </StrictMode>,
  )
}
