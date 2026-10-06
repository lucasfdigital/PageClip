import { Kbd } from '@/components/base/kbd/kbd'

function Card({ title, children }) {
  return (
    <article className="rounded-3xl border border-border-button-default bg-background-primary-default px-[22px] py-5 shadow-card">
      <h2 className="mb-3 text-body-medium">{title}</h2>
      <div className="text-body-regular text-text-secondary [&>p]:mb-2.5 [&>p:last-child]:mb-0 [&_ul]:m-0 [&_ul]:pl-[18px] [&_li+li]:mt-1.5">
        {children}
      </div>
    </article>
  )
}

function Keys({ keys }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {keys.map((key, index) => (
        <span key={key} className="inline-flex items-center gap-1">
          {index > 0 && <span>+</span>}
          <Kbd>{key}</Kbd>
        </span>
      ))}
    </span>
  )
}

export default function HelpPanel() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-4">
      <Card title="Atalhos">
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-2">
          <dt className="whitespace-nowrap"><Keys keys={['Alt', 'Shift', 'S']} /></dt>
          <dd className="m-0">abre (ou fecha) o modo de seleção</dd>
          <dt className="whitespace-nowrap"><Keys keys={['Alt', 'Shift', 'F']} /></dt>
          <dd className="m-0">captura a página inteira na hora</dd>
          <dt className="whitespace-nowrap"><Keys keys={['1', '2', '3']} /></dt>
          <dd className="m-0">alterna entre elemento, região e página</dd>
          <dt className="whitespace-nowrap"><Keys keys={['↑', '↓']} /></dt>
          <dd className="m-0">sobe para o elemento pai / desce para o filho</dd>
          <dt className="whitespace-nowrap"><Keys keys={['←', '→']} /></dt>
          <dd className="m-0">anda entre os elementos irmãos</dd>
          <dt className="whitespace-nowrap"><Kbd>Espaço</Kbd></dt>
          <dd className="m-0">trava a seleção (para mexer o mouse sem perder o alvo)</dd>
          <dt className="whitespace-nowrap"><Kbd>Enter</Kbd></dt>
          <dd className="m-0">captura o que está destacado</dd>
          <dt className="whitespace-nowrap"><Kbd>Esc</Kbd></dt>
          <dd className="m-0">interrompe a captura em andamento, fecha o popup ou sai do modo</dd>
          <dt className="whitespace-nowrap">botão direito</dt>
          <dd className="m-0">sai do modo de captura</dd>
        </dl>
      </Card>

      <Card title="Como o recorte é feito">
        <p>
          O navegador só permite fotografar a parte visível da aba. O PageClip mede o elemento,
          tira a foto, e recorta usando a escala real da imagem, por isso o resultado bate pixel a
          pixel mesmo com zoom do navegador ou tela HiDPI.
        </p>
        <p>
          Quando o alvo é maior que a tela, ele rola a página em partes e costura as fotos.
          Cada pedaço é medido de novo depois de rolar, então nada sai desalinhado.
        </p>
      </Card>

      <Card title="O que ainda não dá">
        <ul>
          <li>Escolher elementos <em>dentro</em> de um iframe de outro domínio, mas dá para selecionar o iframe inteiro, e a imagem sai certa.</li>
          <li>Capturar páginas internas do navegador (<code className="rounded bg-background-secondary-default px-1 font-mono text-body-2-regular">chrome://</code>, a loja de extensões, PDFs).</li>
          <li>Conteúdo que só existe depois de passar o mouse: o destaque não dispara o <code className="rounded bg-background-secondary-default px-1 font-mono text-body-2-regular">:hover</code> da página.</li>
          <li>Imagens com carregamento preguiçoso só entram na foto se já tiverem aparecido: role a página até o fim antes de capturar e, se ainda saírem vazias, aumente a espera entre as fotos.</li>
          <li>Páginas de rolagem infinita não têm fim, a captura para em 80 telas e avisa. Você também pode apertar <Kbd>Esc</Kbd> ou <b>Parar</b> a qualquer momento e ficar com o pedaço já fotografado.</li>
        </ul>
      </Card>

      <Card title="Permissões">
        <p>
          O PageClip não pede acesso a todos os sites. Ele só ganha acesso à aba no momento em que
          você aciona o ícone, o atalho ou o menu de contexto, e perde esse acesso quando a página
          navega. As capturas ficam só na sua máquina.
        </p>
      </Card>
    </div>
  )
}
