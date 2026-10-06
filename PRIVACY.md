# Política de Privacidade do PageClip

🇧🇷 Português · 🇺🇸 [English](#english)

Última atualização: 6 de outubro de 2026.

O PageClip foi feito para não saber nada sobre você.

## Coleta de dados

O PageClip **não coleta, não transmite e não compartilha nenhum dado**. Não tem
conta, não tem servidor, não tem análise de uso e não inclui bibliotecas de
terceiros que enviam dados para fora.

## O que fica no seu computador

- **Capturas**: guardadas no IndexedDB local do navegador, só na sua máquina.
  Apagar a galeria na extensão apaga as imagens de verdade.
- **Preferências**: formato, qualidade, folga, atalhos e limites ficam no
  `chrome.storage` local (com sincronização da sua conta Google via Chrome,
  operada pelo Google, não por nós).

## Permissões e porquê

- `activeTab`: acesso temporário à aba só quando você aciona a extensão, para
  destacar o elemento e fotografar a parte visível.
- `scripting`: mostrar o seletor visual (destaque, barra e painel) durante a captura.
- `storage`: salvar suas preferências localmente.
- `contextMenus`: itens Capturar elemento e Abrir galeria no botão direito.
- `clipboardWrite`: copiar a captura quando você escolhe essa opção.

Nenhuma permissão é usada para coletar dados.

## Código

O PageClip é open source (MIT). Todo o código executado está dentro do pacote
da extensão, sem carregar nada de servidores externos. Audite à vontade em
https://github.com/lucasfdigital/PageClip

## Contato

Dúvidas sobre privacidade: abra uma issue em
https://github.com/lucasfdigital/PageClip/issues

---

<a id="english"></a>

# PageClip Privacy Policy (English)

Last updated: October 6, 2026.

PageClip was built to know nothing about you.

## Data collection

PageClip **does not collect, transmit or share any data**. There's no account,
no server, no usage analytics, and no third-party libraries that send data out.

## What stays on your computer

- **Captures**: stored in the browser's local IndexedDB, only on your machine.
  Deleting the gallery in the extension really deletes the images.
- **Preferences**: format, quality, padding, shortcuts and limits stay in local
  `chrome.storage` (synced through your Google account via Chrome,
  run by Google, not by us).

## Permissions and why

- `activeTab`: temporary access to the tab only when you trigger the extension, to
  highlight the element and shoot the visible part.
- `scripting`: show the visual picker (highlight, bar and panel) during capture.
- `storage`: save your preferences locally.
- `contextMenus`: Capture element and Open gallery items on right click.
- `clipboardWrite`: copy the capture when you choose that option.

No permission is used to collect data.

## Code

PageClip is open source (MIT). All code it runs is inside the extension package,
nothing is loaded from external servers. Feel free to audit it at
https://github.com/lucasfdigital/PageClip

## Contact

Privacy questions: open an issue at
https://github.com/lucasfdigital/PageClip/issues
