import { useCallback, useState } from 'react'
import { PillTab, PillTabList } from '@/components/base/tabs/pill-tab'
import { cx } from '@/utils/cx'
import Gallery from './hub/Gallery.jsx'
import SettingsForm from './hub/SettingsForm.jsx'
import HelpPanel from './hub/HelpPanel.jsx'

const TABS = [
  { id: 'gallery', label: 'Galeria' },
  { id: 'settings', label: 'Ajustes' },
  { id: 'help', label: 'Como usar' },
]

function initialTab() {
  const hash = window.location.hash.slice(1)
  return TABS.some((tab) => tab.id === hash) ? hash : 'gallery'
}

export default function App() {
  const [tab, setTab] = useState(initialTab)

  const select = useCallback((id) => {
    setTab(id)
    window.history.replaceState(null, '', `#${id}`)
  }, [])

  return (
    <div className="min-h-screen bg-background-full text-text-primary">
      <header className="sticky top-0 z-10 border-b border-separator-border bg-background-full/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="./icons/icon48.png" alt="" width="26" height="26" className="size-[26px]" />
            <div>
              <h1 className="text-title-3-semibold">PageClip</h1>
              <p className="text-body-2-regular text-text-secondary">Capturas por elemento do DOM</p>
            </div>
          </div>

          <div
            className={cx(
              'inline-flex items-center gap-1 rounded-full border border-border-button-default',
              'bg-background-primary-default p-[3px]',
            )}
          >
            <PillTabList>
              {TABS.map((item) => (
                <PillTab
                  key={item.id}
                  variant="blue"
                  isSelected={tab === item.id}
                  onSelect={() => select(item.id)}
                >
                  {item.label}
                </PillTab>
              ))}
            </PillTabList>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-6 pt-6 pb-14">
        {tab === 'gallery' && <Gallery />}
        {tab === 'settings' && <SettingsForm />}
        {tab === 'help' && <HelpPanel />}
      </main>
    </div>
  )
}
