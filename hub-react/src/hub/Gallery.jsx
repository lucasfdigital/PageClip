import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RiDeleteBinLine, RiSearchLine } from '@remixicon/react'
import { Badge } from '@/components/base/badges/badge'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Kbd } from '@/components/base/kbd/kbd'
import { clearCaptures, deleteCapture, getCapture, listCaptures } from '../../../src/shared/db.js'
import { formatBytes, formatRelative } from '../../../src/shared/format.js'

/** A partir desta proporção, mostra o topo em vez de encolher tudo. */
function isTall(meta) {
  return Number(meta?.height) / Math.max(1, Number(meta?.width)) > 2.2
}

function haystack(item) {
  const meta = item.meta ?? {}
  return `${meta.site ?? ''} ${meta.title ?? ''} ${meta.selector ?? ''} ${meta.filename ?? ''} ${meta.tag ?? ''}`.toLowerCase()
}

async function toPng(blob) {
  if (blob.type === 'image/png') return blob
  const bitmap = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  canvas.getContext('2d').drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas.convertToBlob({ type: 'image/png' })
}

function CaptureCard({ item, thumbUrl, onRemove }) {
  const meta = item.meta ?? {}
  const [copyLabel, setCopyLabel] = useState('Copiar')

  const download = useCallback(async () => {
    const record = await getCapture(item.id)
    if (!record) return
    const url = URL.createObjectURL(record.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = record.meta?.filename || 'pageclip.png'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }, [item.id])

  const copy = useCallback(async () => {
    try {
      const record = await getCapture(item.id)
      const png = await toPng(record.blob)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      setCopyLabel('Copiado')
    } catch (error) {
      console.error('[PageClip]', error)
      setCopyLabel('Erro')
    }
    setTimeout(() => setCopyLabel('Copiar'), 1600)
  }, [item.id])

  const open = useCallback(async () => {
    const record = await getCapture(item.id)
    if (!record) return
    window.open(URL.createObjectURL(record.blob), '_blank', 'noopener')
  }, [item.id])

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default shadow-card">
      <figure className="relative block h-[170px] overflow-hidden border-b border-separator-border bg-background-secondary-default p-2.5">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={meta.filename ?? 'captura'}
            loading="lazy"
            className={
              isTall(meta)
                ? 'block h-full w-full object-cover object-top'
                : 'block h-full w-full object-contain'
            }
          />
        ) : null}
        {isTall(meta) ? (
          <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-caption-1-semibold text-white">
            só o topo
          </span>
        ) : null}
      </figure>

      <div className="px-3.5 pt-3">
        <b className="block truncate text-body-medium" title={meta.title || meta.url || ''}>
          {meta.site || 'página local'}
        </b>
        <span className="mt-0.5 block truncate font-mono text-caption-1-regular text-text-secondary" title={meta.selector || meta.filename || ''}>
          {meta.selector || meta.filename || ''}
        </span>
        <div className="mt-1.5 text-caption-1-regular text-text-secondary tabular-nums">
          {meta.width} × {meta.height} · {formatBytes(item.bytes)} · {formatRelative(item.createdAt)}
        </div>
      </div>

      <div className="flex gap-1.5 p-3.5">
        <Button variant="secondary" size="small" onPress={download} className="flex-1">
          Baixar
        </Button>
        <Button variant="secondary" size="small" onPress={copy} className="flex-1">
          {copyLabel}
        </Button>
        <Button variant="secondary" size="small" onPress={open} className="flex-1">
          Abrir
        </Button>
        <Button variant="danger" size="small" onPress={() => onRemove(item)} className="flex-1">
          Excluir
        </Button>
      </div>
    </article>
  )
}

export default function Gallery() {
  const [captures, setCaptures] = useState([])
  const [filter, setFilter] = useState('')
  const [thumbs, setThumbs] = useState({})
  const thumbsRef = useRef({})

  const refresh = useCallback(async () => {
    const items = await listCaptures()
    setCaptures(items)
  }, [])

  useEffect(() => {
    refresh()
    const onVisible = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  // Miniaturas viram object URLs revogadas a cada redesenho.
  useEffect(() => {
    for (const url of Object.values(thumbsRef.current)) URL.revokeObjectURL(url)
    const next = {}
    for (const item of captures) {
      if (item.thumb) next[item.id] = URL.createObjectURL(item.thumb)
    }
    thumbsRef.current = next
    setThumbs(next)
    return () => {
      for (const url of Object.values(next)) URL.revokeObjectURL(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captures])

  const needle = filter.trim().toLowerCase()
  const visible = useMemo(
    () => (needle ? captures.filter((item) => haystack(item).includes(needle)) : captures),
    [captures, needle],
  )

  const total = useMemo(
    () => captures.reduce((sum, item) => sum + (item.bytes || 0), 0),
    [captures],
  )

  const summary = useMemo(() => {
    if (!captures.length) return ''
    const size = formatBytes(total)
    if (needle) return `${visible.length} de ${captures.length} capturas · ${size}`
    return `${captures.length} captura${captures.length === 1 ? '' : 's'} · ${size}`
  }, [captures.length, visible.length, needle, total])

  const remove = useCallback(async (item) => {
    await deleteCapture(item.id)
    setCaptures((current) => current.filter((entry) => entry.id !== item.id))
  }, [])

  const clear = useCallback(async () => {
    if (!captures.length) return
    if (!window.confirm(`Apagar as ${captures.length} capturas guardadas? Isso não tem volta.`)) return
    await clearCaptures()
    setCaptures([])
  }, [captures.length])

  return (
    <section aria-label="Galeria">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-body-2-regular text-text-secondary">
          {summary}
          {captures.length > 0 && <Badge color="neutral">{captures.length}</Badge>}
        </p>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Filtrar capturas"
            placeholder="Filtrar por site, seletor ou arquivo"
            value={filter}
            onChange={setFilter}
            leadingIcon={RiSearchLine}
            className="w-[280px]"
          />
          <Button variant="danger" size="small" leadingIcon={RiDeleteBinLine} onPress={clear} isDisabled={!captures.length}>
            Limpar galeria
          </Button>
        </div>
      </div>

      {captures.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border-button-default px-6 py-[72px] text-center">
          <h2 className="text-title-3-semibold">Nada guardado ainda</h2>
          <p className="mx-auto mt-2 max-w-[46ch] text-body-regular text-text-secondary">
            Abra qualquer site, aperte <KbdHint keys={['Alt', 'Shift', 'S']} /> e clique no elemento
            que você quer. As capturas aparecem aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
          {visible.map((item) => (
            <CaptureCard key={item.id} item={item} thumbUrl={thumbs[item.id]} onRemove={remove} />
          ))}
        </div>
      )}
    </section>
  )
}

function KbdHint({ keys }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key, index) => (
        <span key={key} className="inline-flex items-center gap-1">
          {index > 0 && <span className="text-text-tertiary">+</span>}
          <Kbd>{key}</Kbd>
        </span>
      ))}
    </span>
  )
}
