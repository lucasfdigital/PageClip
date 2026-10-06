# PageClip

[![GitHub stars](https://img.shields.io/github/stars/lucasfdigital/PageClip?style=social)](https://github.com/lucasfdigital/PageClip/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/lucasfdigital/PageClip?style=social)](https://github.com/lucasfdigital/PageClip/network/members)
[![Last commit](https://img.shields.io/github/last-commit/lucasfdigital/PageClip)](https://github.com/lucasfdigital/PageClip/commits/main)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Issues](https://img.shields.io/github/issues/lucasfdigital/PageClip)](https://github.com/lucasfdigital/PageClip/issues)
[![Pull requests](https://img.shields.io/github/issues-pr/lucasfdigital/PageClip)](https://github.com/lucasfdigital/PageClip/pulls)

Extensão MV3 (Chrome/Edge) para tirar prints **recortados exatamente num elemento do DOM**.
Você passa o mouse, a extensão destaca o elemento sob o cursor, você clica, e sai um PNG com
exatamente aquele pedaço da página, sem recorte manual.

Também dá para capturar uma **região livre** ou a **página inteira**, e o alvo pode ser **maior
que a tela**: nesse caso a extensão rola a página em partes e costura as fotos.

---

## Instalar

1. Abra `chrome://extensions` (ou `edge://extensions`).
2. Ligue o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha esta pasta.

O content script e o service worker não precisam de build, bundler nem `npm install`,
é JavaScript de módulos ES puro. Requer Chrome/Edge 116 ou mais novo.

A página do hub (galeria/ajustes/ajuda) é a exceção: ela é React + BoardUI e vive em
`hub-react/` (Vite + Tailwind v4). Depois de mexer nela, gere os arquivos usados pela
extensão com:

```
cd hub-react
npm install   # só na primeira vez
npm run build # grava em src/hub-boardui/
```

Depois recarregue a extensão em `chrome://extensions`. Os arquivos antigos em `src/hub/`
ficam guardados como referência, mas quem abre é o `src/hub-boardui/index.html` gerado.

## Usar

| Ação | Como |
| --- | --- |
| Abrir o modo de seleção | ícone da barra, `Alt+Shift+S`, ou botão direito → *Capturar elemento…* |
| Capturar a página inteira na hora | `Alt+Shift+F` |
| Trocar de modo | `1` elemento · `2` região · `3` página |
| Andar pela árvore do DOM | `↑` pai · `↓` filho · `←` `→` irmãos |
| Travar a seleção | `Espaço` (o destaque fica tracejado e para de seguir o mouse) |
| Capturar | clique, ou `Enter` |
| Abrir o painel de opções | botão `›` na barra ou no popup do resultado |
| Parar uma captura longa | botão **Parar**, ou `Esc` |
| Sair | `Esc` ou botão direito |

Navegar com as setas **fixa** o alvo, senão o menor tremor do mouse desfaria a subida
que você acabou de fazer. Essa fixação cede sozinha assim que o mouse anda de propósito
(mais de 10px). Se quiser travar de verdade, para levar o cursor até o painel sem perder
o alvo, use `Espaço`; aí só `Espaço` solta.

### Página inteira

Antes de capturar, **role a página até o fim**. A foto só enxerga o que já foi renderizado,
conteúdo com carregamento preguiçoso que nunca chegou a aparecer não entra na imagem. A
extensão lembra disso na tela sempre que você entra no modo página.

Assim que a captura começa, a barra de progresso mostra quantas telas faltam e traz o botão
**Parar (Esc)**. Interromper não perde o trabalho: a imagem sai recortada exatamente no que já
tinha sido fotografado.

### O popup e o painel lateral

Ao capturar, aparece um **popup pequeno** no canto inferior direito com a prévia, o nome do
arquivo, as dimensões e as ações: Baixar, Copiar, Copiar seletor CSS e Capturar outro.

A seta `›`, que existe tanto no popup quanto na barra do modo de captura, abre o **painel
lateral**, encostado na direita, com os ajustes que mudam de captura para captura (formato,
resolução, folga, o que fazer ao capturar) e as miniaturas das capturas recentes. Clicar numa
miniatura traz aquela imagem de volta para o popup, pronta para baixar ou copiar.

Com o painel aberto, a barra e o popup deslizam para a esquerda em vez de ficarem encobertos.
Fechado, o painel não recebe eventos de ponteiro: a faixa da direita continua sendo da página,
e clicar lá clica no site.

A trilha no canto inferior esquerdo mostra os ancestrais do elemento destacado, clicar num
deles seleciona aquele nível. É o caminho mais rápido para pegar "o card inteiro" em vez do
texto que está debaixo do cursor.

Tudo o que você captura vai para a galeria da extensão (ícone ⚙ na barra do modo de seleção),
onde dá para baixar, copiar, reabrir e apagar. Os ajustes ficam na mesma página.

---

## Como funciona

O navegador só deixa uma extensão fotografar **a parte visível da aba** (`captureVisibleTab`).
Todo o resto é trabalho da extensão:

**Recorte.** Medimos o elemento com `getBoundingClientRect()`, tiramos a foto e cortamos usando a
escala real da imagem (`largura da foto ÷ largura da viewport`). Essa divisão é o detalhe que faz o
recorte bater pixel a pixel com zoom do navegador e telas HiDPI, e ela usa
`documentElement.clientWidth`, não `window.innerWidth`, porque a foto não inclui a barra de
rolagem e o `innerWidth` inclui.

**Costura.** Quando o alvo não cabe na tela, rolamos de pedaço em pedaço. Depois de **cada** rolagem
o alvo é medido de novo e só a parte realmente visível é desenhada na imagem final. Como nada é
extrapolado a partir da posição inicial, não existe erro acumulado: no máximo sobra um pedaço que o
navegador se recusou a mostrar, e isso vira um aviso no painel em vez de uma imagem torta.
Elementos `fixed`/`sticky` que não fazem parte do alvo são escondidos durante a rolagem para não
aparecerem repetidos em cada faixa.

**Containers com rolagem própria.** O mesmo laço funciona rolando um `<div>` interno em vez da
página, então dá para capturar uma tabela inteira dentro de um painel com `overflow: auto`.

**Interface.** Destaque, barra, trilha e painel de resultado vivem num único *shadow root fechado*
pendurado em `<html>`. O CSS da página não alcança nada disso e o nosso não vaza. Só as partes
realmente clicáveis recebem `pointer-events`, então a extensão nunca rouba cliques de áreas onde
não há interface.

**Permissões.** Não há `host_permissions`. A extensão recebe acesso à aba só no instante em que
você aciona o ícone, o atalho ou o menu de contexto (`activeTab`), e perde esse acesso quando a
página navega. Nada sai da sua máquina: as capturas ficam em IndexedDB local e os ajustes em
`storage.sync`.

## Mapa dos arquivos

```
manifest.json
src/
  background/service-worker.js   gatilhos, injeção sob demanda, captureVisibleTab, galeria
  content/
    boot.js                      script clássico que carrega o módulo ES principal
    main.js                      controlador: eventos, teclado, orquestração
    overlay.js                   interface no shadow root
    styles.js                    CSS do overlay
    picker.js                    hit-test (com shadow DOM) e navegação na árvore
    capture.js                   foto, recorte, costura, limites de canvas
  shared/
    protocol.js                  contrato de mensagens entre os contextos
    settings.js                  preferências + normalização
    db.js                        galeria em IndexedDB
    format.js                    nomes de arquivo, datas, tamanhos
  hub/                           hub antigo em JS puro (referência; não abre mais)
  hub-boardui/                   hub atual, gerado pelo build do hub-react (não editar à mão)
  hub-react/                     fonte do hub: React 19 + Tailwind v4 + BoardUI
icons/
```

```
hub-react/
  src/App.jsx                    marca, navegação por abas e painéis
  src/hub/Gallery.jsx            galeria (BoardUI: Button, Input, Badge, Kbd)
  src/hub/SettingsForm.jsx       ajustes (BoardUI: Select, Slider, Switch, Input)
  src/hub/HelpPanel.jsx          ajuda (BoardUI: Kbd)
  src/components/                componentes BoardUI (`npx boardui add <nome>`)
  src/styles/                    tema, tipografia e estilos globais do BoardUI
```

O estado "esta aba está em modo de seleção?" **não** é guardado no service worker, ele pode ser
encerrado a qualquer momento e a resposta ficaria mentindo. Em vez disso o service worker pergunta
à aba (`PING`) antes de decidir se abre ou fecha o modo.

## Ajustes que valem conhecer

- **Resolução**, `Da tela` sai na densidade física (mais nítido, arquivo maior); `1 pixel CSS = 1 pixel`
  sai no tamanho lógico.
- **Espera entre as fotos**, aumente se o site carrega imagens conforme você rola e elas saem
  vazias na costura.
- **Folga ao redor do elemento**, respiro em pixels; com PNG a folga que cai fora da página fica
  transparente.
- **Nome do arquivo**, template com `{site}` `{tag}` `{mode}` `{date}` `{time}` `{w}` `{h}`.

## Limitações conhecidas

- Não dá para escolher elementos **dentro de um iframe de outro domínio**, mas dá para selecionar
  o `<iframe>` inteiro, e a imagem sai correta (o recorte vem da foto da aba, não do DOM interno).
- Páginas internas do navegador (`chrome://`, loja de extensões, visualizador de PDF) bloqueiam
  qualquer extensão. O ícone pisca um `!` explicando.
- O destaque não dispara o `:hover` da página, então menus que só existem com o mouse em cima
  precisam ser abertos antes, trave a seleção com `Espaço` para não perder o alvo.
- `captureVisibleTab` tem cota de poucas chamadas por segundo. Capturas costuradas começam rápidas
  e desaceleram sozinhas se o Chrome reclamar, então uma página muito longa leva alguns segundos.
- **Rolagem infinita** (YouTube, feeds): essas páginas declaram uma altura enorme e crescem
  enquanto você rola, então "a página inteira" não tem fim. O PageClip para em 80 telas e avisa,
  e a imagem final é reduzida se passar de 100 megapixels, sem isso o canvas sozinho comeria
  centenas de MB de RAM. Você também pode apertar **Parar** a qualquer momento: a imagem sai
  recortada no que já tinha sido fotografado, em vez de se perder.
- A aba precisa ficar em primeiro plano durante a captura. `captureVisibleTab` fotografa a aba
  *visível* da janela, se você trocar de aba no meio de uma costura, a foto seguinte seria de
  outra página. A extensão detecta isso e para com um aviso em vez de emendar lixo.
- Conteúdo que muda de tamanho durante a rolagem (carrossel, lista virtualizada) pode sair
  inconsistente; nesse caso aparece um aviso no painel.

## Empacotar

Para a Chrome Web Store / Edge Add-ons, basta zipar o conteúdo desta pasta (o `manifest.json`
precisa ficar na raiz do zip), **excluindo** `hub-react/` (`src`, `node_modules`, configs do
Vite): a extensão só usa o `src/hub-boardui/` já gerado. Para um `.crx` local, use
*Empacotar extensão* em `chrome://extensions` e guarde o `.pem` gerado, é ele que mantém
o mesmo ID entre versões.

## Contribuindo

O PageClip é open source (MIT). Abra issues e PRs à vontade, o fluxo está
descrito em [CONTRIBUTING.md](CONTRIBUTING.md).

---

<p align="center">Crafted by <a href="https://github.com/lucasfdigital">Lucas Fernandes</a></p>
