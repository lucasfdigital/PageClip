# Publicar o PageClip na Chrome Web Store

Guia para um agente com acesso ao navegador. Objetivo: deixar o item PageClip
pronto e enviado para revisão. Não mexa no código, só no console da loja.

## Ponto de partida (já pronto)

- Console: https://chrome.google.com/u/3/webstore/devconsole/3d941234-0691-438f-a70b-c087ea7db0cd?hl=pt-br
- Pacote: `PageClip-v1.0.3.zip` (ou baixe o asset da release https://github.com/lucasfdigital/PageClip/releases/tag/v1.0.3)
- Ícone da loja: `icons/icon128.png` do projeto
- Print: `/Users/beatrizmartins/Downloads/pageclip-capa/capa-loja-1280x800.png` (1280x800 exatos, RGB sem alfa)
- Conta de negociante: já declarada como não negociante
- Manifest: nome PageClip, versão 1.0.3

## Passo 1, pacote

1. Abra a página do item PageClip no console
2. Vá em Pacote e suba o `PageClip-v1.0.3.zip`
3. Confira que a versão lida é 1.0.3

## Passo 2, listagem da loja

- Descrição curta: `Capture qualquer elemento da página com precisão de pixel: aponte, clique, pronto. Região livre e página inteira inclusos.`

- Descrição detalhada: `PageClip captura recortes exatos de elementos de qualquer página. Passe o mouse, o elemento é destacado, clique e pronto, sai um PNG só daquele pedaço, sem recorte manual. Também captura regiões livres e a página inteira, costurando a rolagem quando o alvo é maior que a tela. Inclui galeria local, cantos arredondados, atalhos de teclado e navegação pela árvore do DOM. Tudo acontece no seu computador: sem conta, sem servidor, sem envio de dados.`
- Ícone: suba o `icons/icon128.png`
- Prints: suba o `capa-loja-1280x800.png` (se reclamar de tamanho, confira 1280x800, JPEG ou PNG de 24 bits sem alfa)
- Categoria: Produtividade. Idioma: Português (Brasil)

## Passo 3, privacidade

- Propósito único: `Capturar recortes exatos de elementos do DOM, regiões livres ou a página inteira como imagem.`
- Justificativas, uma por permissão:
  - activeTab: `Acesso temporário à aba só quando o usuário aciona a extensão pelo ícone, atalho ou menu, para destacar o elemento e fotografar a parte visível.`
  - scripting: `Injetar o seletor visual (destaque, barra e painel) somente após o acionamento pelo usuário.`
  - storage: `Salvar as preferências do usuário (formato, qualidade, folga, atalhos) localmente.`
  - contextMenus: `Adicionar Capturar elemento e Abrir galeria do PageClip ao menu de botão direito.`
  - clipboardWrite: `Copiar a captura para a área de transferência quando o usuário escolhe essa opção.`
- Código remoto: marque **Não, não estou usando código remoto** (todo o código está no pacote, verificado)
- Uso de dados: não marque nenhum tipo de dado. Marque as três declarações de conformidade
- Política de privacidade: `https://github.com/lucasfdigital/PageClip/blob/main/PRIVACY.md`

## Passo 4, distribuição e configurações

- Preço gratuita, distribuição pública
- E-mail de contato do publisher preenchido e verificado em Configurações (se pedir verificação, pare aqui e peça ao Lucas para confirmar o e-mail)

## Passo 5, envio

1. Salve o rascunho
2. Confira que não resta nenhum erro de validação na página
3. Clique em Enviar para revisão

## Pronto quando

O status do item mostra em revisão ou publicado. Anote e reporte: versão do pacote enviada, data e eventuais avisos do revisor.
