import { Fragment, memo, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import {
  RiArrowLeftSLine,
  RiArrowRightLine,
  RiArrowRightSLine,
  RiCodeSSlashLine,
  RiDownloadLine,
  RiFileCopyLine,
  RiGithubFill,
  RiInformationFill,
  RiScreenshot2Line,
} from '@remixicon/react'
import { Badge } from '@/components/base/badges/badge'
import { Button } from '@/components/base/buttons/button'
import { CloseButton } from '@/components/base/buttons/close-button'
import { Input } from '@/components/base/input/input'
import { Kbd } from '@/components/base/kbd/kbd'
import { Notification } from '@/components/base/notification/notification'
import { Select, SelectItem } from '@/components/base/select/select'
import { Switch } from '@/components/base/switch/switch'
import { PillTab, PillTabList } from '@/components/base/tabs/pill-tab'
import { cx } from '@/utils/cx'
import { useStore } from './store.js'

const MODES = [
  { id: 'element', label: 'Elemento', key: '1' },
  { id: 'region', label: 'Região', key: '2' },
  { id: 'page', label: 'Página', key: '3' },
]

/** Superfície flutuante padrão (barra, dica, trilha, progresso). */
const FLOAT =
  'border border-border-button-default bg-background-primary-default/90 shadow-dropdown backdrop-blur-md'

/** Quanto a pilha do topo e o popup andam quando o painel lateral abre. */
const SIDE_WIDTH = 340

const SPRING = { type: 'spring', bounce: 0, visualDuration: 0.2 }

export function OverlayApp({ store, frame, onAction }) {
  return (
    <MotionConfig reducedMotion="user" transition={SPRING}>
      <Frame frame={frame} />
      <TopStack store={store} onAction={onAction} />
      <Crumbs store={store} onAction={onAction} />
      <ResultPanel store={store} onAction={onAction} />
      <Progress store={store} onAction={onAction} />
      <Toast store={store} />
      <Sidebar store={store} onAction={onAction} />
    </MotionConfig>
  )
}

/**
 * Destaque que segue o mouse. Renderiza uma vez só: a posição e o texto são
 * escritos direto nos elementos por Overlay.showFrame, sem passar pelo React
 * a cada movimento. `frame(nome, nó)` entrega cada elemento ao Overlay.
 */
const Frame = memo(function Frame({ frame }) {
  return (
    <div
      ref={(node) => frame('box', node)}
      data-frame
      className="pointer-events-none absolute top-0 left-0 rounded-[3px] border-2 border-solid will-change-transform"
    >
      <div
        ref={(node) => frame('tag', node)}
        data-tag
        className="absolute -left-0.5 flex max-w-[78vw] items-center gap-2 overflow-hidden rounded-md px-2 py-[3px] text-caption-1-semibold whitespace-nowrap text-text-white"
      >
        <b ref={(node) => frame('label', node)} />
        <span ref={(node) => frame('size', node)} className="tabular-nums opacity-75" />
      </div>
    </div>
  )
})

function SideToggle({ open, onAction }) {
  return (
    <Button
      variant="secondary"
      size="small"
      iconOnly
      leadingIcon={open ? RiArrowRightSLine : RiArrowLeftSLine}
      aria-label={open ? 'Fechar opções' : 'Abrir opções'}
      title={open ? 'Fechar opções' : 'Abrir opções'}
      onClick={() => onAction('sidebar')}
      className="text-accent-600"
    />
  )
}

function TopStack({ store, onAction }) {
  const mode = useStore(store, (s) => s.mode)
  const hint = useStore(store, (s) => s.hint)
  const notice = useStore(store, (s) => s.notice)
  const sideOpen = useStore(store, (s) => s.sideOpen)

  return (
    <div className="pointer-events-none absolute top-3.5 left-1/2 -translate-x-1/2">
      <motion.div
        className="flex flex-col items-center gap-[7px]"
        initial={false}
        animate={{ x: sideOpen ? -SIDE_WIDTH / 2 : 0 }}
      >
        <div className={cx('pointer-events-auto flex items-center gap-1.5 rounded-full p-1.5 select-none', FLOAT)}>
          <PillTabList>
            {MODES.map((item) => (
              <PillTab
                key={item.id}
                isSelected={mode === item.id}
                onSelect={() => onAction('mode', { mode: item.id })}
              >
                {item.label}
                <Kbd className="ms-1.5">{item.key}</Kbd>
              </PillTab>
            ))}
          </PillTabList>
          <SideToggle open={sideOpen} onAction={onAction} />
          <CloseButton size="md" aria-label="Sair (Esc)" title="Sair (Esc)" onClick={() => onAction('close')} />
        </div>

        {hint ? (
          <div className={cx('max-w-[min(76ch,88vw)] truncate rounded-full px-4 py-1.5 text-body-2-regular text-text-secondary', FLOAT)}>
            {hint}
          </div>
        ) : null}

        {notice ? (
          <div
            className={cx(
              'flex max-w-[min(74ch,88vw)] items-center gap-2 rounded-full px-4 py-2 text-body-2-regular text-text-primary',
              FLOAT,
            )}
          >
            <RiInformationFill className="size-4 shrink-0 text-accent-600" aria-hidden />
            <span>{notice}</span>
          </div>
        ) : null}
      </motion.div>
    </div>
  )
}

function Crumbs({ store, onAction }) {
  const crumbs = useStore(store, (s) => s.crumbs)
  const visible = useStore(store, (s) => s.crumbsOn)
  if (!visible || crumbs.length === 0) return null

  const last = crumbs.length - 1
  return (
    <nav
      aria-label="Ancestrais do elemento"
      className={cx(
        'pointer-events-auto absolute bottom-3.5 left-3.5 flex max-w-[min(60vw,720px)] items-center gap-0.5 overflow-hidden rounded-2xl p-1 select-none',
        FLOAT,
      )}
    >
      {crumbs.map((label, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <span aria-hidden className="text-caption-1-regular text-text-tertiary">
              ›
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onAction('crumb', { index: String(index) })}
            className={cx('min-w-0 shrink font-mono', index === last ? 'text-accent-600' : 'text-text-secondary')}
          >
            {label}
          </Button>
        </Fragment>
      ))}
    </nav>
  )
}

function ResultPanel({ store, onAction }) {
  const shot = useStore(store, (s) => s.shot)
  const open = useStore(store, (s) => s.panelOn)
  const sideOpen = useStore(store, (s) => s.sideOpen)

  return (
    <AnimatePresence>
      {open && shot ? (
        <motion.section
          key="panel"
          aria-label="Captura pronta"
          className="pointer-events-auto absolute right-3.5 bottom-3.5 w-[300px] overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default text-text-primary shadow-dropdown"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1, x: sideOpen ? -SIDE_WIDTH : 0 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
        >
          <header className="flex items-center gap-1 border-b border-separator-border py-2 ps-3.5 pe-2">
            <strong className="flex-1 text-body-2-semibold">Captura pronta</strong>
            <span className="text-caption-1-regular text-text-secondary tabular-nums">
              {shot.width} × {shot.height}
            </span>
            <SideToggle open={sideOpen} onAction={onAction} />
            <CloseButton size="sm" aria-label="Fechar" title="Fechar" onClick={() => onAction('close-panel')} />
          </header>

          <div className="px-3.5 pt-3 pb-3.5">
            <img
              src={shot.url}
              alt={`Prévia de ${shot.filename}`}
              className="pc-checker block max-h-[210px] w-full rounded-lg object-contain"
            />
            <p className="mt-2 font-mono text-caption-1-regular break-all text-text-secondary select-text">
              {shot.filename}
            </p>

            {shot.warnings?.length ? (
              <div className="mt-2.5 flex flex-col gap-1 rounded-lg border-s-2 border-border-error-default bg-notification-error-background px-2.5 py-2 text-caption-1-regular text-text-error-primary">
                {shot.warnings.map((message, index) => (
                  <p key={index}>{message}</p>
                ))}
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <Button size="small" leadingIcon={RiDownloadLine} onClick={() => onAction('download')}>
                Baixar
              </Button>
              <Button variant="secondary" size="small" leadingIcon={RiFileCopyLine} onClick={() => onAction('copy')}>
                Copiar
              </Button>
              {shot.selector ? (
                <Button
                  variant="secondary"
                  size="small"
                  leadingIcon={RiCodeSSlashLine}
                  onClick={() => onAction('copy-selector')}
                  className="col-span-2"
                >
                  Copiar seletor CSS
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="small"
                leadingIcon={RiScreenshot2Line}
                onClick={() => onAction('again')}
                className="col-span-2"
              >
                Capturar outro <Kbd className="ms-1">Espaço</Kbd>
              </Button>
            </div>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  )
}

function Progress({ store, onAction }) {
  const progress = useStore(store, (s) => s.progress)
  if (!progress) return null

  const { done, total } = progress
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div
      data-progress
      className={cx(
        'pointer-events-auto absolute top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full py-1.5 ps-4 pe-1.5 text-body-2-regular whitespace-nowrap text-text-primary',
        FLOAT,
      )}
    >
      <span className="tabular-nums">{total > 1 ? `Capturando ${done} de ${total}` : 'Capturando'}</span>
      <span className="h-1 w-24 overflow-hidden rounded-full bg-background-tertiary-default">
        <motion.span
          className="block h-full origin-left rounded-full bg-accent-600"
          initial={false}
          animate={{ scaleX: percent / 100 }}
          transition={{ duration: 0.12, ease: 'linear' }}
        />
      </span>
      <Button variant="secondary" size="xs" title="Interromper a captura" onClick={() => onAction('cancel')}>
        Parar (Esc)
      </Button>
    </div>
  )
}

const TONE = { busy: 'information', done: 'success', error: 'error' }
const TONE_MS = { done: 2600, error: 6000 }

function Toast({ store }) {
  const toast = useStore(store, (s) => s.toast)
  return (
    <div className="pointer-events-none absolute bottom-3.5 left-1/2 w-[min(360px,calc(100vw-24px))] -translate-x-1/2">
      <AnimatePresence initial={false} mode="popLayout">
        {toast ? (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
          >
            <Notification
              title={toast.message}
              status={TONE[toast.tone] ?? 'neutral'}
              dismissible={false}
              autoDismissDuration={TONE_MS[toast.tone]}
              onDismiss={() => store.set((s) => (s.toast?.id === toast.id ? { toast: null } : {}))}
              className="p-3 pe-3"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Painel lateral                                                             */
/* -------------------------------------------------------------------------- */

const FORMATS = [
  ['png', 'PNG'],
  ['jpeg', 'JPEG'],
  ['webp', 'WebP'],
]

const SCALES = [
  ['x2', 'Alta 2×'],
  ['x3', 'Alta 3×'],
  ['device', 'Da tela'],
  ['css', '1× CSS'],
]

function Sidebar({ store, onAction }) {
  const open = useStore(store, (s) => s.sideOpen)
  const settings = useStore(store, (s) => s.settings)
  const history = useStore(store, (s) => s.history)
  const stars = useStore(store, (s) => s.stars)
  const set = (name, value) => onAction('setting', { name, value })

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="side"
          aria-label="Opções do PageClip"
          className="pointer-events-auto absolute inset-y-0 right-0 flex w-[340px] max-w-[92vw] flex-col border-s border-border-button-default bg-background-primary-default text-text-primary shadow-sidebar"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
        >
          <header className="flex items-center gap-1 border-b border-separator-border py-2.5 ps-4 pe-2">
            <span className="flex items-center gap-2 py-1">
              <BrandMark />
              <b className="text-body-semibold">PageClip</b>
            </span>
            {Number.isFinite(stars) ? (
              <Button
                variant="secondary"
                size="xs"
                leadingIcon={RiGithubFill}
                title="Abrir o PageClip no GitHub"
                onClick={() => onAction('github')}
                className="ms-auto"
              >
                Stars <Badge className="ms-1 tabular-nums">{stars}</Badge>
              </Button>
            ) : (
              <span className="ms-auto" />
            )}
            <CloseButton size="sm" aria-label="Fechar painel" title="Fechar painel" onClick={() => onAction('close-side')} />
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            <section className="flex flex-col gap-2.5 border-b border-separator-border p-4">
              <h3 className="text-caption-1-semibold tracking-[0.07em] text-text-secondary uppercase">Ajustes rápidos</h3>

              <Field label="Formato">
                <Select
                  aria-label="Formato"
                  size="sm"
                  selectedKey={settings.format}
                  onSelectionChange={(key) => set('format', String(key))}
                >
                  {FORMATS.map(([id, label]) => (
                    <SelectItem key={id} id={id}>
                      {label}
                    </SelectItem>
                  ))}
                </Select>
              </Field>

              <Field label="Resolução">
                <Select
                  aria-label="Resolução"
                  size="sm"
                  selectedKey={settings.scale}
                  onSelectionChange={(key) => set('scale', String(key))}
                >
                  {SCALES.map(([id, label]) => (
                    <SelectItem key={id} id={id}>
                      {label}
                    </SelectItem>
                  ))}
                </Select>
              </Field>

              <Field label="Folga">
                <NumberField name="padding" value={settings.padding} onCommit={set} />
              </Field>

              <Field label="Cantos">
                <NumberField name="radius" value={settings.radius} onCommit={set} />
              </Field>

              <div className="flex flex-col gap-2 pt-1">
                <Switch size="sm" isSelected={Boolean(settings.downloadOnCapture)} onChange={(value) => set('downloadOnCapture', value)}>
                  Baixar ao capturar
                </Switch>
                <Switch size="sm" isSelected={Boolean(settings.copyOnCapture)} onChange={(value) => set('copyOnCapture', value)}>
                  Copiar ao capturar
                </Switch>
                <Switch size="sm" isSelected={settings.saveToGallery !== false} onChange={(value) => set('saveToGallery', value)}>
                  Guardar na galeria
                </Switch>
              </div>
            </section>

            <section className="flex flex-col gap-2.5 p-4">
              <h3 className="text-caption-1-semibold tracking-[0.07em] text-text-secondary uppercase">Últimas capturas</h3>
              {history.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {history.map((item) => (
                    <HistoryThumb key={item.id} item={item} onAction={onAction} />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border-button-default px-2.5 py-3.5 text-center text-body-2-regular text-text-secondary">
                  Nada guardado ainda.
                </p>
              )}
            </section>
          </div>

          <footer className="border-t border-separator-border bg-background-secondary-default p-2">
            <Button
              variant="ghost"
              trailingIcon={RiArrowRightLine}
              onClick={() => onAction('hub')}
              className="w-full text-accent-600"
            >
              Abrir hub completo
            </Button>
          </footer>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-body-2-regular text-text-primary">{label}</span>
      {children}
    </div>
  )
}

/**
 * Número que só grava ao sair do campo ou apertar Enter: gravar a cada tecla
 * passaria pelo normalize() e um campo vazio viraria 0 no meio da digitação.
 */
function NumberField({ name, value, onCommit }) {
  const saved = String(value ?? '')
  // null = sem edição em curso: o campo mostra o valor gravado.
  const [draft, setDraft] = useState(null)

  const commit = () => {
    if (draft !== null && draft !== saved) onCommit(name, draft)
    setDraft(null)
  }

  return (
    <span className="flex items-center gap-1.5">
      <Input
        type="number"
        inputMode="numeric"
        size="small"
        aria-label={name === 'padding' ? 'Folga em pixels' : 'Cantos em pixels'}
        value={draft ?? saved}
        onChange={setDraft}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
        }}
        className="w-[76px]"
      />
      <span className="text-caption-1-regular text-text-secondary">px</span>
    </span>
  )
}

function HistoryThumb({ item, onAction }) {
  const tall = Number(item.meta?.height) / Math.max(1, Number(item.meta?.width)) > 2.2
  return (
    <button
      type="button"
      title={`${item.meta?.filename ?? ''}\n${item.meta?.selector ?? ''}`}
      onClick={() => onAction('history', { id: item.id })}
      className="flex cursor-pointer flex-col gap-1 rounded-lg border border-border-button-default bg-background-secondary-default p-1.5 text-start outline-none transition-colors hover:border-border-button-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
    >
      {item.thumb ? (
        <img
          src={item.thumb}
          alt={item.meta?.filename ?? 'captura'}
          className={cx('pc-checker h-[62px] w-full rounded', tall ? 'object-cover object-top' : 'object-contain')}
        />
      ) : (
        <span className="pc-checker block h-[62px] w-full rounded" />
      )}
      <small className="truncate text-caption-1-regular text-text-secondary">{item.meta?.tag ?? ''}</small>
    </button>
  )
}

function BrandMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 30 30" fill="none" aria-hidden="true" className="shrink-0">
      <rect width="30" height="30" rx="8" className="fill-accent-600" />
      <g className="stroke-text-white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.25 12V9.75C8.25 9.35218 8.40804 8.97064 8.68934 8.68934C8.97064 8.40804 9.35218 8.25 9.75 8.25H12" />
        <path d="M18 8.25H20.25C20.6478 8.25 21.0294 8.40804 21.3107 8.68934C21.592 8.97064 21.75 9.35218 21.75 9.75V12" />
        <path d="M21.75 18V20.25C21.75 20.6478 21.592 21.0294 21.3107 21.3107C21.0294 21.592 20.6478 21.75 20.25 21.75H18" />
        <path d="M12 21.75H9.75C9.35218 21.75 8.97064 21.592 8.68934 21.3107C8.40804 21.0294 8.25 20.6478 8.25 20.25V18" />
        <circle cx="15" cy="15" r="2.4" />
      </g>
    </svg>
  )
}
