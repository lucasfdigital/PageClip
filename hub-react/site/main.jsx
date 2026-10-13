import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { DirectionProvider } from '@/components/foundations/direction/direction'
import './site.css'
import App from './App.jsx'

// O HTML já vem montado do build (scripts/prerender-site.js); aqui o React
// só assume a página para animações e o contador de stars.
hydrateRoot(
  document.getElementById('root'),
  <StrictMode>
    <DirectionProvider locale="pt-BR">
      <App />
    </DirectionProvider>
  </StrictMode>,
)
