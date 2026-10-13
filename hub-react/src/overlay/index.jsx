/**
 * Interface do modo de captura (a barra que aparece dentro dos sites), em
 * React + BoardUI.
 *
 * Mantém a mesma API da versão antiga em HTML puro: o controlador
 * (src/content/main.js) chama os mesmos métodos e recebe as mesmas ações.
 *
 * Tudo mora num único shadow root fechado pendurado em `<html>`:
 *   - o CSS do site não alcança nada disto e o nosso não vaza;
 *   - só os pedaços interativos recebem `pointer-events`;
 *   - esconder tudo antes da foto é um atributo no host (`phase`).
 *
 * Texto vindo da página (seletores, nomes de arquivo) entra como texto do
 * React ou por `textContent`, nunca como HTML.
 */

import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { UNSAFE_PortalProvider } from 'react-aria/PortalProvider'
import { enableShadowDOM } from 'react-stately/private/flags/flags'
import { DirectionProvider } from '@/components/foundations/direction/direction'
import css from './overlay.css?inline'
import interLatin from '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?inline'
import { createStore } from './store.js'
import { OverlayApp } from './OverlayApp.jsx'

// Foco, cliques fora e navegação por teclado do React Aria atravessando o
// shadow root. Precisa valer antes do primeiro render.
enableShadowDOM()

const HOST_TAG = 'pageclip-overlay'
const FONT_FAMILY = 'PageClip Inter'

const HINTS = {
  element: 'Clique para capturar · ↑↓←→ percorre o DOM',
  region: 'Arraste para escolher a área',
  page: 'Clique ou Enter para capturar a página inteira',
}

/**
 * Enquanto o alvo está fixado, a dica passa a explicar como soltá-lo: é a
 * única hora em que essa informação importa, e ela some sozinha depois.
 */
const LOCK_HINTS = {
  auto: 'Alvo fixado pelo teclado · mexa o mouse para soltar',
  manual: 'Seleção travada · Espaço para soltar',
}

/**
 * A foto só enxerga o que já está renderizado. Em página com carregamento
 * preguiçoso, capturar sem ter rolado antes produz uma imagem cheia de buracos.
 */
const PAGE_NOTICE = 'Role a página até o fim antes de capturar: o que ainda não carregou não entra na imagem.'

function initialState() {
  return {
    mode: 'element',
    hint: '',
    notice: '',
    crumbs: [],
    crumbsOn: false,
    shot: null,
    panelOn: false,
    progress: null,
    toast: null,
    sideOpen: false,
    settings: {},
    history: [],
    stars: null,
  }
}

let fontPromise = null

/**
 * `@font-face` dentro de shadow root é ignorado; a fonte precisa estar no
 * documento. Vai por FontFace com um nome só nosso (não esbarra nas fontes do
 * site) e a partir dos bytes embutidos no pacote, então a CSP do site não tem
 * o que bloquear. Se falhar, fica a fonte do sistema.
 */
function loadFont() {
  fontPromise ??= (async () => {
    if ([...document.fonts].some((face) => face.family === FONT_FAMILY)) return
    const bytes = await (await fetch(interLatin)).arrayBuffer()
    const face = new FontFace(FONT_FAMILY, bytes, { weight: '100 900', display: 'swap' })
    await face.load()
    document.fonts.add(face)
  })().catch(() => {})
  return fontPromise
}

export class Overlay {
  #host = null
  #root = null
  #react = null
  #store = createStore(initialState())
  #frame = {}
  #onAction
  #accent
  #toastId = 0
  #observer = null

  /** Mesma forma da versão antiga: `overlay.sidebar.toggle()` etc. */
  sidebar = null

  /** @param {{ accent: string, onAction: (action: string, detail: any) => void }} config */
  constructor({ accent, onAction }) {
    this.#accent = accent
    this.#onAction = onAction
  }

  /** Cria o host e o shadow root. Idempotente. */
  mount() {
    if (this.#host?.isConnected) return

    this.#host = document.createElement(HOST_TAG)
    this.#host.style.setProperty('--pc-accent', this.#accent)
    this.#root = this.#host.attachShadow({ mode: 'closed' })

    const sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
    this.#root.adoptedStyleSheets = [sheet]

    const container = document.createElement('div')
    // Menus suspensos (Select) abrem aqui, dentro da caixa. O host não recebe
    // cliques; a camada dos menus precisa receber.
    const portal = document.createElement('div')
    portal.style.pointerEvents = 'auto'
    this.#root.append(container, portal)

    const store = this.#store
    store.set(initialState())
    this.#frame = {}
    this.sidebar = this.#sidebarApi()

    this.#react = createRoot(container)
    // Render síncrono: main.js chama showFrame logo depois do mount, e o
    // destaque precisa já existir.
    flushSync(() => {
      this.#react.render(
        <DirectionProvider locale="pt-BR">
          <UNSAFE_PortalProvider getContainer={() => portal}>
            <OverlayApp
              store={store}
              frame={(key, node) => (this.#frame[key] = node)}
              onAction={(action, detail = {}) => this.#onAction(action, detail)}
            />
          </UNSAFE_PortalProvider>
        </DirectionProvider>,
      )
    })

    document.documentElement.appendChild(this.#host)
    this.#watchRemoval()
    loadFont()
  }

  /** Remove tudo e libera as URLs de preview. */
  destroy() {
    this.#observer?.disconnect()
    this.#observer = null
    this.#releasePreview()
    this.#react?.unmount()
    this.#react = null
    this.sidebar = null
    this.#host?.remove()
    this.#host = null
    this.#root = null
    this.#frame = {}
  }

  /**
   * Controla o que fica na tela durante uma captura.
   * @param {'idle'|'working'|'shooting'} phase
   *   idle     tudo visível;
   *   working  só a pílula de progresso (para o usuário poder parar);
   *   shooting nada: é o quadro que vai virar imagem.
   */
  async setPhase(phase) {
    if (!this.#host) return

    if (phase === 'idle') this.#host.removeAttribute('phase')
    else this.#host.setAttribute('phase', phase)

    // Esperamos o quadro ser pintado: senão a foto sai com a interface ainda nela.
    await new Promise((resolve) => {
      const fallback = setTimeout(resolve, 200)
      requestAnimationFrame(() => {
        clearTimeout(fallback)
        resolve()
      })
    })
  }

  /** Mostra (ou esconde, com `null`) a pílula de progresso com o botão Parar. */
  setProgress(done, total) {
    this.#store.set({ progress: done === null ? null : { done, total } })
  }

  /** O popup e a pilha do topo saem de baixo do painel lateral quando ele abre. */
  setSidebarState(open) {
    this.#store.set({ sideOpen: Boolean(open) })
  }

  /**
   * Popup pequeno com o resultado da captura.
   * @param {{ blob: Blob, width: number, height: number, filename: string, warnings?: string[], selector?: string }} shot
   */
  showPanel(shot) {
    this.#releasePreview()
    this.#store.set({
      shot: {
        url: URL.createObjectURL(shot.blob),
        width: shot.width,
        height: shot.height,
        filename: shot.filename,
        warnings: shot.warnings ?? [],
        selector: shot.selector ?? '',
      },
      panelOn: true,
    })
  }

  hidePanel() {
    this.#store.set({ panelOn: false })
  }

  get panelOpen() {
    return this.#store.get().panelOn
  }

  /**
   * O nó pertence à nossa interface?
   *
   * O shadow root é fechado: eventos nascidos lá dentro chegam ao resto da
   * página com o alvo reapontado para o host, então comparar com o host basta.
   */
  owns(node) {
    if (!this.#host || !(node instanceof Node)) return false
    return node === this.#host || this.#host.contains(node) || Boolean(this.#root?.contains(node))
  }

  /**
   * Alguém está digitando ou navegando num controle da barra (campo de
   * número, lista do Select)? Nesse caso os atalhos do modo de captura
   * (1/2/3, setas, Espaço, Enter) ficam com o controle.
   */
  isEditing() {
    const active = this.#root?.activeElement
    if (!active) return false
    return Boolean(
      active.matches('input, textarea, select, [contenteditable], [aria-haspopup]') ||
        active.closest('[role="listbox"], [role="combobox"], [role="dialog"]'),
    )
  }

  setAccent(accent) {
    this.#accent = accent
    this.#host?.style.setProperty('--pc-accent', accent)
  }

  setMode(mode) {
    this.#store.set({ mode, notice: mode === 'page' ? PAGE_NOTICE : '' })
    this.setLock('free')
  }

  /** Recado fixo abaixo da barra. Texto vazio esconde. */
  setNotice(text) {
    this.#store.set({ notice: text })
  }

  /** @param {'free'|'auto'|'manual'} state */
  setLock(state) {
    this.setHint(state === 'free' ? (HINTS[this.#store.get().mode] ?? '') : LOCK_HINTS[state])
  }

  setHint(text) {
    this.#store.set({ hint: text })
  }

  /**
   * Posiciona o destaque. Chamado a cada movimento do mouse: escreve direto
   * nos elementos, sem render do React.
   * @param {{left: number, top: number, width: number, height: number, bottom?: number}} box coordenadas da viewport
   * @param {{ label?: string, size?: string, locked?: boolean, dim?: boolean }} info
   */
  showFrame(box, info = {}) {
    const { box: frame, tag, label, size } = this.#frame
    if (!frame) return

    frame.dataset.on = '1'
    frame.dataset.dim = info.dim ? '1' : '0'
    frame.dataset.locked = info.locked ? '1' : '0'
    frame.style.transform = `translate(${Math.round(box.left)}px, ${Math.round(box.top)}px)`
    frame.style.width = `${Math.max(0, Math.round(box.width))}px`
    frame.style.height = `${Math.max(0, Math.round(box.height))}px`

    label.textContent = info.label ?? ''
    size.textContent = info.size ?? ''
    tag.hidden = !info.label && !info.size
    tag.dataset.place = tagPlacement(box)
  }

  hideFrame() {
    if (this.#frame.box) this.#frame.box.dataset.on = '0'
  }

  /**
   * Trilha de ancestrais.
   * @param {string[]} labels do mais externo ao alvo atual
   */
  setCrumbs(labels) {
    this.#store.set({ crumbs: labels, crumbsOn: labels.length > 0 })
  }

  hideCrumbs() {
    this.#store.set({ crumbsOn: false })
  }

  /**
   * @param {string} message
   * @param {'busy'|'done'|'error'} tone
   */
  toast(message, tone = 'done') {
    this.#toastId += 1
    this.#store.set({ toast: { id: this.#toastId, message, tone } })
  }

  hideToast() {
    this.#store.set({ toast: null })
  }

  #sidebarApi() {
    const store = this.#store
    return {
      get open() {
        return store.get().sideOpen
      },
      /** @param {boolean} [force] omitir alterna */
      toggle(force) {
        const open = force ?? !store.get().sideOpen
        store.set({ sideOpen: open })
        return open
      },
      /** Contagem de stars do GitHub; sem número, o selo some. */
      setStars(count) {
        store.set({ stars: Number.isFinite(count) ? count : null })
      },
      /** Preenche os ajustes rápidos. */
      setSettings(settings) {
        store.set({ settings: { ...settings } })
      },
      /** @param {Array<{id: string, thumb: string|null, meta: object}>} items */
      setHistory(items) {
        store.set({ history: items ?? [] })
      },
    }
  }

  /** Alguns sites recriam `<html>` inteiro; nesse caso reinserimos o overlay. */
  #watchRemoval() {
    this.#observer = new MutationObserver(() => {
      if (this.#host && !this.#host.isConnected) document.documentElement.appendChild(this.#host)
    })
    this.#observer.observe(document.documentElement, { childList: true })
  }

  #releasePreview() {
    const url = this.#store.get().shot?.url
    if (url) URL.revokeObjectURL(url)
  }
}

/** O balão do destaque cabe acima? Senão vai abaixo; e se nada couber, entra no canto. */
function tagPlacement(box) {
  if (box.top >= 26) return 'above'
  const bottom = box.bottom ?? box.top + box.height
  if (bottom + 26 <= document.documentElement.clientHeight) return 'below'
  return 'inside'
}
