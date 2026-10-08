import { useEffect, useRef, useState } from 'react'
import { RiKeyboardLine, RiRefreshLine } from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Select, SelectItem } from '@/components/base/select/select'
import { Slider } from '@/components/base/slider/slider'
import { Switch } from '@/components/base/switch/switch'
import { getSettings, patchSettings, resetSettings, normalize, DEFAULTS } from '../../../src/shared/settings.js'
import { buildFilename } from '../../../src/shared/format.js'

const hasChromeStorage =
  typeof chrome !== 'undefined' && Boolean(chrome?.storage?.sync?.get)

async function loadSettings() {
  if (!hasChromeStorage) return { ...DEFAULTS }
  try {
    return await getSettings()
  } catch {
    return { ...DEFAULTS }
  }
}

function Fieldset({ legend, children }) {
  return (
    <fieldset className="mb-[18px] rounded-3xl border border-border-button-default bg-background-primary-default px-5 py-[18px]">
      <legend className="px-2 text-caption-1-semibold tracking-[0.07em] text-text-secondary uppercase">
        {legend}
      </legend>
      {children}
    </fieldset>
  )
}

function Row({ label, children, hint }) {
  return (
    <div className="py-2.5">
      <label className="flex items-center gap-3">
        <span className="flex-1 text-body-regular">{label}</span>
        {children}
      </label>
      {hint && <p className="mt-1.5 text-body-2-regular text-text-secondary">{hint}</p>}
    </div>
  )
}

const numberInputClass =
  'w-[90px] rounded-lg border border-border-button-default bg-background-full px-2.5 py-[7px] text-body-regular outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring'

const colorInputClass =
  'h-[30px] w-12 cursor-pointer rounded-lg border border-border-button-default bg-background-full p-0.5'

export default function SettingsForm() {
  const [draft, setDraft] = useState({ ...DEFAULTS })
  const [saved, setSaved] = useState('')
  const saveTimer = useRef(0)

  useEffect(() => {
    loadSettings().then(setDraft)
  }, [])

  useEffect(() => {
    if (!hasChromeStorage || typeof chrome.storage?.onChanged?.addListener !== 'function') return
    const listener = () => {
      if (document.activeElement?.closest?.('form')) return
      loadSettings().then(setDraft)
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  useEffect(() => () => window.clearTimeout(saveTimer.current), [])

  // Espelha o refreshDerived do hub original: prévia, rótulos e visibilidade
  // derivam do valor normalizado, enquanto os campos mostram o rascunho cru.
  const view = normalize({ ...draft, mode: undefined })
  const lossy = view.format !== 'png'
  const preview = buildFilename(view.filenameTemplate, {
    site: 'exemplo.com',
    tag: 'article',
    mode: 'element',
    width: 960,
    height: 540,
    format: view.format,
  })

  const scheduleSave = (next) => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      const { mode: _mode, ...rest } = normalize({ ...next, mode: undefined })
      if (hasChromeStorage) {
        try {
          await patchSettings(rest)
        } catch {
          /* fora da extensão: guarda só em memória */
        }
      }
      setSaved('Salvo')
      window.setTimeout(() => setSaved(''), 1400)
    }, 250)
  }

  const update = (patch) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      scheduleSave(next)
      return next
    })
  }

  const reset = async () => {
    const fresh = hasChromeStorage ? await resetSettings().catch(() => ({ ...DEFAULTS })) : { ...DEFAULTS }
    window.clearTimeout(saveTimer.current)
    setDraft(fresh)
    setSaved('Padrões restaurados')
    window.setTimeout(() => setSaved(''), 1800)
  }

  const openShortcuts = () => {
    if (typeof chrome !== 'undefined' && chrome?.tabs?.create) {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
    }
  }

  return (
    <form autoComplete="off" className="max-w-[720px]" onSubmit={(event) => event.preventDefault()}>
      <Fieldset legend="Imagem">
        <Row label="Formato">
          <Select
            aria-label="Formato"
            selectedKey={view.format}
            onSelectionChange={(key) => update({ format: String(key) })}
            className="w-[300px]"
          >
            <SelectItem id="png">PNG, sem perdas, com transparência</SelectItem>
            <SelectItem id="jpeg">JPEG, arquivo menor, sem transparência</SelectItem>
            <SelectItem id="webp">WebP, menor ainda</SelectItem>
          </Select>
        </Row>

        {lossy && (
          <Row label={`Qualidade · ${Math.round(view.quality * 100)}%`}>
            <Slider
              aria-label="Qualidade"
              value={view.quality}
              onChange={(value) => update({ quality: value })}
              minValue={0.4}
              maxValue={1}
              step={0.02}
              formatValue={(value) => `${Math.round(value * 100)}%`}
              className="w-[180px]"
            />
          </Row>
        )}

        <Row label="Resolução">
          <Select
            aria-label="Resolução"
            selectedKey={view.scale}
            onSelectionChange={(key) => update({ scale: String(key) })}
            className="w-[300px]"
          >
            <SelectItem id="device">Da tela (nítida em telas HiDPI)</SelectItem>
            <SelectItem id="css">1 pixel CSS = 1 pixel</SelectItem>
          </Select>
        </Row>

        <Row label="Folga ao redor do elemento">
          <span className="flex items-center gap-2">
            <input
              type="number"
              aria-label="Folga ao redor do elemento"
              min="0"
              max="200"
              step="1"
              value={draft.padding}
              onChange={(event) => update({ padding: event.target.value })}
              className={numberInputClass}
            />
            <em className="text-body-2-regular text-text-secondary not-italic">px</em>
          </span>
        </Row>

        <Row label="Cantos arredondados">
          <span className="flex items-center gap-2">
            <input
              type="number"
              aria-label="Cantos arredondados"
              min="0"
              max="200"
              step="1"
              value={draft.radius}
              onChange={(event) => update({ radius: event.target.value })}
              className={numberInputClass}
            />
            <em className="text-body-2-regular text-text-secondary not-italic">px</em>
          </span>
        </Row>

        {lossy && (
          <Row label="Cor de fundo (formatos sem transparência)">
            <input
              type="color"
              aria-label="Cor de fundo"
              value={view.matte}
              onChange={(event) => update({ matte: event.target.value })}
              className={colorInputClass}
            />
          </Row>
        )}
      </Fieldset>

      <Fieldset legend="Ao capturar">
        <div className="flex flex-col gap-1 py-1">
          <Switch isSelected={Boolean(draft.downloadOnCapture)} onChange={(value) => update({ downloadOnCapture: value })}>
            Baixar o arquivo automaticamente
          </Switch>
          <Switch isSelected={Boolean(draft.copyOnCapture)} onChange={(value) => update({ copyOnCapture: value })}>
            Copiar para a área de transferência
          </Switch>
          <Switch isSelected={draft.saveToGallery !== false} onChange={(value) => update({ saveToGallery: value })}>
            Guardar na galeria da extensão
          </Switch>
        </div>

        <Row label="Nome do arquivo">
          <Input
            aria-label="Nome do arquivo"
            value={String(draft.filenameTemplate ?? '')}
            onChange={(value) => update({ filenameTemplate: value })}
            className="w-[300px]"
          />
        </Row>
        <p className="mt-1.5 text-body-2-regular text-text-secondary">
          Tokens: <code className="rounded bg-background-secondary-default px-1 font-mono text-body-2-regular">{'{site}'}</code>{' '}
          <code className="rounded bg-background-secondary-default px-1 font-mono text-body-2-regular">{'{tag}'}</code>{' '}
          <code className="rounded bg-background-secondary-default px-1 font-mono text-body-2-regular">{'{mode}'}</code>{' '}
          <code className="rounded bg-background-secondary-default px-1 font-mono text-body-2-regular">{'{date}'}</code>{' '}
          <code className="rounded bg-background-secondary-default px-1 font-mono text-body-2-regular">{'{time}'}</code>{' '}
          <code className="rounded bg-background-secondary-default px-1 font-mono text-body-2-regular">{'{w}'}</code>{' '}
          <code className="rounded bg-background-secondary-default px-1 font-mono text-body-2-regular">{'{h}'}</code>{' '}
         , resultado: <b className="font-mono font-medium text-text-primary">{preview}</b>
        </p>

        <Row label="Capturas guardadas na galeria">
          <input
            type="number"
            aria-label="Capturas guardadas na galeria"
            min="0"
            max="200"
            step="1"
            value={draft.historyLimit}
            onChange={(event) => update({ historyLimit: event.target.value })}
            className={numberInputClass}
          />
        </Row>
      </Fieldset>

      <Fieldset legend="Alvos maiores que a tela">
        <div className="py-1">
          <Switch isSelected={draft.hideFixed !== false} onChange={(value) => update({ hideFixed: value })}>
            Esconder cabeçalhos fixos e elementos sticky durante a rolagem
          </Switch>
        </div>
        <Row
          label="Espera entre as fotos"
          hint="Aumente se a página carrega imagens conforme você rola e elas aparecem borradas ou vazias na costura."
        >
          <span className="flex items-center gap-2">
            <input
              type="number"
              aria-label="Espera entre as fotos"
              min="0"
              max="2000"
              step="10"
              value={draft.tileDelay}
              onChange={(event) => update({ tileDelay: event.target.value })}
              className={numberInputClass}
            />
            <em className="text-body-2-regular text-text-secondary not-italic">ms</em>
          </span>
        </Row>
      </Fieldset>

      <Fieldset legend="Interface">
        <div className="py-1">
          <Switch isSelected={draft.showLabels !== false} onChange={(value) => update({ showLabels: value })}>
            Mostrar seletor e dimensões junto do destaque
          </Switch>
        </div>
      </Fieldset>

      <div className="flex items-center gap-2.5">
        <Button variant="secondary" size="small" leadingIcon={RiKeyboardLine} onClick={openShortcuts}>
          Editar atalhos do teclado
        </Button>
        <Button variant="danger" size="small" leadingIcon={RiRefreshLine} onClick={reset}>
          Restaurar padrões
        </Button>
        <span aria-live="polite" className="text-body-2-regular text-text-secondary">
          {saved}
        </span>
      </div>
    </form>
  )
}
