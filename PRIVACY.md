# Política de Privacidade do PageClip

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
