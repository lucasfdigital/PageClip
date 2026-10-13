import { useEffect, useState } from 'react'
import { MotionConfig, motion } from 'motion/react'
import { RiGithubFill } from '@remixicon/react'
import { Badge } from '@/components/base/badges/badge'
import { ButtonLink } from '@/components/base/buttons/button'
import { Kbd } from '@/components/base/kbd/kbd'
import { cx } from '@/utils/cx'

const STORE_URL = 'https://chromewebstore.google.com/detail/dflihojebkolifkikknjdgipgmgihplm'
const REPO_URL = 'https://github.com/lucasfdigital/PageClip'

const external = { target: '_blank', rel: 'noopener' }

/** Botões grandes do topo e das chamadas: o BoardUI vai até 36px de altura. */
const BIG = 'h-12 rounded-xl px-5 text-headline-semibold'

const FEATURES = [
  ['Elemento exato', 'O recorte usa a escala real da imagem, então bate pixel a pixel mesmo com zoom do navegador ou tela HiDPI.'],
  ['Região livre', 'Arraste para escolher qualquer área da página, com folga ajustável ao redor do recorte.'],
  ['Página inteira', 'Alvos maiores que a tela são fotografados em partes e costurados sem erro acumulado, com botão Parar.'],
  ['Navegação no DOM', 'Setas percorrem pai, filho e irmãos, a trilha de ancestrais mostra o caminho e Espaço trava a seleção.'],
  ['Galeria local', 'Histórico com busca, prévia e ações de baixar, copiar, abrir e excluir. Nada sai da sua máquina.'],
  ['Do seu jeito', 'PNG, JPEG ou WebP, nome de arquivo com tokens, copiar ao capturar, baixar automático e mais.'],
]

const SHORTCUTS = [
  [['Alt', '+', 'Shift', '+', 'S'], 'Abre ou fecha o modo de seleção'],
  [['Alt', '+', 'Shift', '+', 'F'], 'Captura a página inteira na hora'],
  [['1', '2', '3'], 'Alterna entre elemento, região e página'],
  [['↑', '↓', '←', '→'], 'Navega pela árvore do DOM'],
  [['Espaço'], 'Trava ou solta a seleção'],
  [['Enter', '/', 'Esc'], 'Captura ou sai do modo'],
]

/** Contador de stars ao vivo; se o GitHub não responder, o número some. */
function useStars() {
  const [stars, setStars] = useState(null)
  useEffect(() => {
    fetch('https://api.github.com/repos/lucasfdigital/PageClip')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (typeof data?.stargazers_count === 'number') setStars(data.stargazers_count)
      })
      .catch(() => {})
  }, [])
  return stars
}

/** Seção que aparece suave ao rolar até ela. */
function Reveal({ as = 'section', className, children, ...props }) {
  const Tag = motion[as]
  return (
    <Tag
      data-reveal
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={className}
      {...props}
    >
      {children}
    </Tag>
  )
}

function Keys({ keys }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {keys.map((key, index) =>
        key === '+' || key === '/' ? (
          <span key={index} className="text-body-regular text-text-secondary">
            {key}
          </span>
        ) : (
          <Kbd key={index} className="px-2 py-1">
            {key}
          </Kbd>
        ),
      )}
    </span>
  )
}

function BrandMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none" aria-hidden="true" className="shrink-0">
      <rect width="30" height="30" rx="8" className="fill-accent-600" />
      <g className="stroke-text-white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.25 12V9.75C8.25 9.35218 8.40804 8.97064 8.68934 8.68934C8.97064 8.40804 9.35218 8.25 9.75 8.25H12" />
        <path d="M18 8.25H20.25C20.6478 8.25 21.0294 8.40804 21.3107 8.68934C21.592 8.97064 21.75 9.35218 21.75 9.75V12" />
        <path d="M21.75 18V20.25C21.75 20.6478 21.592 21.0294 21.3107 21.3107C21.0294 21.592 20.6478 21.75 20.25 21.75H18" />
        <path d="M12 21.75H9.75C9.35218 21.75 8.97064 21.592 8.68934 21.3107C8.40804 21.0294 8.25 20.6478 8.25 20.25V18" />
        <circle cx="15" cy="15" r="2.4" />
      </g>
    </svg>
  )
}

function Card({ className, children }) {
  return (
    <div className={cx('rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-xs', className)}>
      {children}
    </div>
  )
}

function SectionTitle({ children }) {
  return <h2 className="text-display-4-semibold tracking-tight text-text-primary">{children}</h2>
}

export default function App() {
  const stars = useStars()

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-background-primary-default text-text-primary">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-separator-border bg-background-primary-default/90 px-4 py-3 backdrop-blur-md sm:px-7">
          <a href="#topo" aria-label="PageClip, início" className="inline-flex items-center gap-2.5 text-title-2-semibold text-text-primary">
            <BrandMark />
            PageClip
          </a>
          <nav aria-label="Navegação" className="hidden items-center gap-1 lg:flex">
            {[
              ['#recursos', 'Recursos'],
              ['#como-funciona', 'Como funciona'],
              ['#atalhos', 'Atalhos'],
              ['#privacidade', 'Privacidade'],
            ].map(([href, label]) => (
              <ButtonLink key={href} href={href} variant="ghost" size="small" className="text-text-secondary">
                {label}
              </ButtonLink>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <ButtonLink href={REPO_URL} {...external} variant="secondary" leadingIcon={RiGithubFill} aria-label="PageClip no GitHub">
              {stars !== null ? <Badge className="tabular-nums">{stars}</Badge> : null}
            </ButtonLink>
            <ButtonLink href={STORE_URL} {...external}>
              Instalar grátis
            </ButtonLink>
          </div>
        </header>

        <main id="topo">
          <section className="mx-auto grid max-w-[1180px] items-center gap-12 px-4 pt-12 pb-14 sm:px-7 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] min-[900px]:pt-18">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
              <p className="mb-4 inline-block rounded-full bg-accent-50 px-4 py-1.5 text-body-semibold text-accent-700">
                Extensão gratuita e open source para Chrome e Edge
              </p>
              <h1 className="mb-4 text-display-3-bold tracking-tight text-balance sm:text-display-1-bold">
                Captura <span className="text-accent-600">pixel-perfect</span> de qualquer elemento
              </h1>
              <p className="mb-7 max-w-[34em] text-title-3-regular text-text-secondary">
                Passe o mouse, o elemento é destacado, clique e pronto. Sai um PNG só daquele pedaço, sem recorte manual. Região livre e página inteira inclusos.
              </p>
              <div className="mb-5 flex flex-wrap gap-3">
                <ButtonLink href={STORE_URL} {...external} className={BIG}>
                  Instalar grátis
                </ButtonLink>
                <ButtonLink href={REPO_URL} {...external} variant="secondary" className={BIG}>
                  Ver código fonte
                </ButtonLink>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-body-medium text-text-secondary">
                {['Sem conta', 'Sem servidor', '100% local'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span aria-hidden className="size-2 rounded-full bg-accent-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <Reveal as="figure" className="m-0">
              <img
                src="assets/hero.png"
                alt="Demonstração do PageClip destacando um elemento da página"
                width="1280"
                height="800"
                className="h-auto w-full rounded-3xl border border-border-button-default shadow-dropdown"
              />
            </Reveal>
          </section>

          <Reveal id="recursos" className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-14 sm:px-7">
            <SectionTitle>Feito para capturar do seu jeito</SectionTitle>
            <div className="mt-7 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
              {FEATURES.map(([title, text]) => (
                <Card key={title}>
                  <h3 className="mb-2 text-headline-semibold">{title}</h3>
                  <p className="text-headline-regular text-text-secondary">{text}</p>
                </Card>
              ))}
            </div>
          </Reveal>

          <Reveal id="como-funciona" className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-14 sm:px-7">
            <SectionTitle>Como funciona</SectionTitle>
            <ol className="mt-7 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
              {[
                [<>Aperte <Keys keys={['Alt', '+', 'Shift', '+', 'S']} /></>, 'O modo de seleção abre na aba atual.'],
                ['Aponte para o elemento', 'O destaque mostra tag, seletor e dimensões.'],
                [<>Clique ou aperte <Keys keys={['Enter']} /></>, 'A imagem cai na galeria, na área de transferência ou em download, como você configurou.'],
              ].map(([title, text], index) => (
                <li key={index}>
                  <Card className="h-full bg-linear-to-b from-accent-50 to-background-primary-default to-70%">
                    <span className="mb-3 inline-grid size-8 place-items-center rounded-full bg-accent-600 text-body-bold text-text-white">
                      {index + 1}
                    </span>
                    <b className="mb-1.5 block text-headline-semibold">{title}</b>
                    <span className="text-headline-regular text-text-secondary">{text}</span>
                  </Card>
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal id="atalhos" className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-14 sm:px-7">
            <SectionTitle>Atalhos</SectionTitle>
            <dl className="mt-7 grid gap-2">
              {SHORTCUTS.map(([keys, text], index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-border-button-default bg-background-primary-default px-5 py-3"
                >
                  <dt>
                    <Keys keys={keys} />
                  </dt>
                  <dd className="text-headline-regular text-text-secondary">{text}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal id="privacidade" className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-14 sm:px-7">
            <SectionTitle>Privacidade de verdade</SectionTitle>
            <p className="mt-3 max-w-[44em] text-title-3-regular text-text-secondary">
              O PageClip <b className="text-text-primary">não coleta, não transmite e não compartilha nenhum dado</b>. Sem conta, sem servidor, sem análise de uso. As capturas ficam no IndexedDB local e os ajustes no armazenamento local do navegador. Todo o código é aberto (MIT) e está no GitHub para auditar.
            </p>
            <ButtonLink href={`${REPO_URL}/blob/main/PRIVACY.md`} {...external} variant="secondary" className="mt-5">
              Ler a política completa
            </ButtonLink>
          </Reveal>

          <Reveal id="instalar" className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-14 sm:px-7">
            <SectionTitle>Instalar em 1 minuto</SectionTitle>
            <div className="my-5">
              <ButtonLink href={STORE_URL} {...external} className={BIG}>
                Adicionar ao Chrome, é grátis
              </ButtonLink>
            </div>
            <p className="mb-2 text-headline-regular text-text-secondary">
              Prefere instalar manualmente? Baixe o{' '}
              <a href={REPO_URL} {...external} className="text-accent-600 underline-offset-2 hover:underline">
                repositório
              </a>
              , abra <code className="rounded-md bg-background-secondary-default px-2 py-0.5 font-mono text-body-regular">chrome://extensions</code>, ligue o{' '}
              <b className="text-text-primary">Modo do desenvolvedor</b> e use <b className="text-text-primary">Carregar sem compactação</b> na pasta do projeto.
            </p>
            <p className="text-headline-regular text-text-secondary">Requer Chrome ou Edge 116 ou mais novo.</p>
          </Reveal>
        </main>

        <footer className="border-t border-separator-border bg-background-secondary-default px-6 py-9 text-center">
          <p className="mb-1.5 text-headline-regular">
            Crafted by{' '}
            <a href="https://github.com/lucasfdigital" {...external} className="text-accent-600 underline-offset-2 hover:underline">
              Lucas Fernandes
            </a>
          </p>
          <p className="text-body-regular text-text-secondary">
            PageClip é open source sob licença MIT. Marca e código no{' '}
            <a href={REPO_URL} {...external} className="text-accent-600 underline-offset-2 hover:underline">
              GitHub
            </a>
            .
          </p>
        </footer>
      </div>
    </MotionConfig>
  )
}
