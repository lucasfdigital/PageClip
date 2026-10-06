/**
 * CSS do overlay.
 *
 * Vive dentro de um shadow root fechado, então nada aqui vaza para a página e
 * nenhuma regra da página entra. O `all: initial` no `:host` é a única defesa
 * necessária contra folhas de estilo agressivas do site (`* { ... }`).
 *
 * A única cor configurável entra por `--pc-accent`, definido inline no host —
 * `all` não zera custom properties, então isso sobrevive ao reset.
 */

export const OVERLAY_CSS = `
:host {
  all: initial;
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483647 !important;
  display: block !important;
  pointer-events: none !important;
  color-scheme: light;
  font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  /* Superfícies e texto seguem os tokens light do BoardUI:
     primary #fff, secondary #f7f7f7, tertiary #ebebeb,
     texto #0a0a0a, secundário #737373, borda #ebebeb. */
  --bg: #ffffff;
  --bg-soft: #f7f7f7;
  --bg-tertiary: #ebebeb;
  --line: #ebebeb;
  --line-hover: #d4d4d4;
  --text: #0a0a0a;
  --muted: #737373;
  --on-accent: #ffffff;
  --danger: #dc2626;
  --danger-deep: #b91c1c;
  --warn: #b45309;
  --radius: 10px;
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow: 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

/*
 * Fases da captura.
 *
 * 'working' esconde a interface mas mantém a pílula de progresso — é ela que
 * carrega o botão parar. 'shooting' esconde tudo, porque é o instante exato em
 * que a foto é tirada e qualquer pixel nosso entraria na imagem.
 *
 * Funciona porque a propriedade visibility é herdada: o host esconde a árvore
 * e o descendente pede visibilidade de volta.
 */
:host([phase="working"]),
:host([phase="shooting"]) { visibility: hidden !important; }
:host([phase="working"]) .progress[data-on="1"] { visibility: visible; }

* { box-sizing: border-box; margin: 0; padding: 0; }

/* Anel de foco no padrão BoardUI (ring azul de 2px). */
button:focus-visible,
select:focus-visible,
input:focus-visible {
  outline: 2px solid var(--pc-accent);
  outline-offset: 1px;
}

button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

/* ------------------------------------------------------------------ destaque */

.frame {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  will-change: transform, width, height;
  border: 2px solid var(--pc-accent);
  border-radius: 3px;
  background: color-mix(in srgb, var(--pc-accent) 8%, transparent);
  pointer-events: none;
  contain: layout style;
}

.frame[data-on="1"] { display: block; }
.frame[data-dim="1"] { box-shadow: 0 0 0 100vmax rgba(8, 10, 14, 0.55); }
.frame[data-locked="1"] { border-style: dashed; }

.tag {
  position: absolute;
  left: -2px;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 78vw;
  padding: 3px 8px;
  border-radius: 5px;
  background: var(--pc-accent);
  color: var(--on-accent);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag[hidden] { display: none; }
.tag[data-place="above"] { bottom: calc(100% + 5px); }
.tag[data-place="below"] { top: calc(100% + 5px); }
.tag[data-place="inside"] { top: 4px; left: 4px; }

.tag b { font-weight: 650; }
.tag span { opacity: 0.72; font-variant-numeric: tabular-nums; }

/* ------------------------------------------------------------------- barra */

/*
 * Pilha do topo: a barra e, abaixo dela, a dica e o recado.
 *
 * Ficam num contêiner só para se moverem juntos quando o painel lateral abre —
 * e para a dica caber inteira, em vez de disputar espaço dentro da barra e
 * acabar cortada por reticências.
 */
.top {
  position: absolute;
  top: 14px;
  left: 50%;
  display: flex;
  flex-direction: column;
  /* Centralizado, não alinhado à esquerda: as dicas têm comprimentos diferentes,
     e ancorar pela esquerda faria a composição inteira balançar a cada troca. */
  align-items: center;
  gap: 7px;
  transform: translateX(-50%);
  transition: transform 180ms ease;
  pointer-events: none;
}

.top[data-side="1"] { transform: translateX(calc(-50% - 170px)); }

.hud {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
  color: var(--text);
  pointer-events: auto;
  user-select: none;
}

.modes { display: flex; gap: 2px; }

.mode {
  padding: 5px 12px;
  border-radius: 999px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 550;
  white-space: nowrap;
}

.mode:hover { background: var(--bg-soft); color: var(--text); }
.mode[data-on="1"] { background: var(--pc-accent); color: var(--on-accent); }
.mode kbd {
  margin-left: 6px;
  opacity: 0.6;
  font: inherit;
  font-size: 10px;
}

/* Linha própria abaixo da barra: cabe inteira, sem reticências. */
.hint {
  max-width: min(76ch, 88vw);
  padding: 6px 15px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hint:empty { display: none; }

.icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  color: var(--muted);
  font-size: 14px;
}

.icon:hover { background: var(--bg-soft); color: var(--text); }

/*
 * A seta do painel some no meio dos outros ícones cinzas se não tiver cor —
 * e é o único caminho para as opções.
 */
.side-toggle {
  background: color-mix(in srgb, var(--pc-accent) 16%, transparent);
  color: var(--pc-accent);
  font-size: 16px;
  font-weight: 700;
}

.side-toggle:hover {
  background: color-mix(in srgb, var(--pc-accent) 30%, transparent);
  color: var(--pc-accent);
}

/* ----------------------------------------------------------------- recado */

.notice {
  display: none;
  align-items: center;
  gap: 9px;
  max-width: min(74ch, 88vw);
  padding: 8px 16px;
  border: 1px solid color-mix(in srgb, var(--warn) 40%, var(--line));
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
  color: var(--text);
  font-size: 12px;
  line-height: 1.35;
  pointer-events: none;
  transition: transform 180ms ease;
}

.notice[data-on="1"] { display: flex; }
.notice b { flex: 0 0 auto; color: var(--warn); font-size: 13px; }

/* --------------------------------------------------------------- migalhas */

.crumbs {
  position: absolute;
  left: 14px;
  bottom: 14px;
  display: none;
  align-items: center;
  gap: 2px;
  max-width: min(60vw, 720px);
  padding: 5px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
  overflow: hidden;
  pointer-events: auto;
  user-select: none;
}

.crumbs[data-on="1"] { display: flex; }

.crumb {
  flex: 0 1 auto;
  padding: 3px 8px;
  border-radius: 6px;
  color: var(--muted);
  font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.crumb:hover { background: var(--bg-soft); color: var(--text); }
.crumb[data-on="1"] { color: var(--pc-accent); }
.sep { color: var(--line); font-size: 11px; }

/* --------------------------------------------- popup do resultado (pequeno) */

.panel {
  position: absolute;
  right: 14px;
  bottom: 14px;
  display: none;
  width: 300px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--bg);
  box-shadow: var(--shadow);
  color: var(--text);
  overflow: hidden;
  pointer-events: auto;
  transition: right 180ms ease;
}

.panel[data-on="1"] { display: block; }
/* Com a lateral aberta, o popup sai de baixo dela. */
.panel[data-side="1"] { right: 354px; }

.panel > header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 9px 8px 9px 14px;
  border-bottom: 1px solid var(--line);
}

.panel > header strong { flex: 1; font-size: 12px; font-weight: 620; }
.panel > header .dims { color: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.panel .body { padding: 12px 14px 14px; }

.name {
  margin-top: 8px;
  color: var(--muted);
  font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
  font-size: 11px;
  word-break: break-all;
  user-select: text;
}

/* ------------------------------------------------------------ painel lateral */

.side {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  width: 340px;
  max-width: 92vw;
  border-left: 1px solid var(--line);
  background: var(--bg);
  box-shadow: -18px 0 48px rgba(0, 0, 0, 0.42);
  color: var(--text);
  /* Fechado ele fica fora da tela E sem eventos: a faixa da direita continua
     sendo da página, que era exatamente o defeito do painel antigo. */
  transform: translateX(100%);
  transition: transform 180ms ease;
  pointer-events: none;
  visibility: hidden;
}

.side[data-on="1"] {
  transform: translateX(0);
  pointer-events: auto;
  visibility: visible;
}

.side > header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 8px 10px 16px;
  border-bottom: 1px solid var(--line);
}

.side > header b { flex: 1; font-size: 13px; font-weight: 620; letter-spacing: -0.01em; }

.side-body { flex: 1; overflow-y: auto; overscroll-behavior: contain; }
.side-body::-webkit-scrollbar { width: 10px; }
.side-body::-webkit-scrollbar-thumb { border: 3px solid var(--bg); border-radius: 999px; background: var(--line); }

.blank {
  padding: 26px 10px;
  border: 1px dashed var(--line);
  border-radius: 10px;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}

.blank.small { padding: 14px 10px; }
.blank[hidden] { display: none; }

.group { padding: 14px; border-bottom: 1px solid var(--line); }

.group h3 {
  margin-bottom: 10px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.field { display: flex; align-items: center; gap: 8px; padding: 5px 0; }
.field > span { flex: 1; font-size: 12px; }
.field i { color: var(--muted); font-size: 11px; font-style: normal; }

.field select, .field input[type="number"] {
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--bg-soft);
  color: var(--text);
  font: inherit;
  font-size: 12px;
}

.field input[type="number"] { width: 68px; }

.opt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  font-size: 12px;
  cursor: pointer;
}

.opt input { accent-color: var(--pc-accent); }

.history { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

.thumb {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-soft);
  text-align: left;
}

.thumb:hover { border-color: var(--line-hover); }
.thumb img {
  width: 100%;
  height: 62px;
  object-fit: contain;
  border-radius: 4px;
  background-color: #ffffff;
  background-image:
    linear-gradient(45deg, rgba(128, 128, 128, 0.14) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(128, 128, 128, 0.14) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(128, 128, 128, 0.14) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(128, 128, 128, 0.14) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}
.thumb[data-tall="1"] img { object-fit: cover; object-position: top center; }
.thumb small { color: var(--muted); font-size: 10px; }

/*
 * Rodapé fixo do painel: é a única porta para o hub (galeria completa e todos
 * os ajustes), então ganha peso de barra em vez de virar um link cinza perdido
 * no fim de uma coluna quase vazia.
 */
.side > footer {
  border-top: 1px solid color-mix(in srgb, var(--pc-accent) 34%, var(--line));
  background: color-mix(in srgb, var(--pc-accent) 13%, transparent);
}

.link {
  display: block;
  width: 100%;
  padding: 14px 16px;
  color: var(--pc-accent);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  transition: background 120ms;
}

.link:hover { background: color-mix(in srgb, var(--pc-accent) 22%, transparent); }

.shot {
  display: block;
  width: 100%;
  max-height: 210px;
  border-radius: 8px;
  object-fit: contain;
  background-color: var(--bg-soft);
  background-image:
    linear-gradient(45deg, rgba(128, 128, 128, 0.14) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(128, 128, 128, 0.14) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(128, 128, 128, 0.14) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(128, 128, 128, 0.14) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}

.warn {
  margin: 10px 0 0;
  padding: 7px 9px;
  border-left: 2px solid var(--danger);
  border-radius: 0 6px 6px 0;
  background: color-mix(in srgb, var(--danger) 8%, transparent);
  color: var(--danger-deep);
  font-size: 11px;
}

.warn p + p { margin-top: 4px; }
.warn:empty { display: none; }

.acts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 12px;
}

.act {
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-soft);
  font-size: 12px;
  font-weight: 550;
  text-align: center;
  transition: border-color 120ms, background 120ms;
}

.act:hover { border-color: var(--line-hover); background: var(--bg-soft); }
.act[data-wide="1"] { grid-column: 1 / -1; }
.act[data-primary="1"] {
  border-color: transparent;
  background: linear-gradient(180deg, color-mix(in srgb, var(--pc-accent) 85%, white), var(--pc-accent));
  box-shadow: var(--shadow-xs);
  color: var(--on-accent);
}
.act[data-primary="1"]:hover { filter: brightness(1.06); background: linear-gradient(180deg, color-mix(in srgb, var(--pc-accent) 85%, white), var(--pc-accent)); }

/* -------------------------------------------------------------- progresso */

.progress {
  position: absolute;
  top: 14px;
  left: 50%;
  display: none;
  align-items: center;
  gap: 12px;
  padding: 6px 6px 6px 16px;
  transform: translateX(-50%);
  border: 1px solid var(--line);
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg) 95%, transparent);
  box-shadow: var(--shadow);
  color: var(--text);
  font-size: 12px;
  white-space: nowrap;
  pointer-events: auto;
}

.progress[data-on="1"] { display: flex; }
.progress .count { font-variant-numeric: tabular-nums; }

.bar {
  width: 96px;
  height: 4px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}

.bar i {
  display: block;
  width: 0;
  height: 100%;
  border-radius: 999px;
  background: var(--pc-accent);
  transition: width 120ms linear;
}

.stop {
  padding: 5px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg-soft);
  font-size: 11px;
  font-weight: 600;
}

.stop:hover { border-color: var(--danger); color: var(--danger); }

/* ----------------------------------------------------------------- toast */

.toast {
  position: absolute;
  bottom: 14px;
  left: 50%;
  display: none;
  align-items: center;
  gap: 8px;
  max-width: 60vw;
  padding: 8px 14px;
  transform: translateX(-50%);
  border: 1px solid var(--line);
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
  color: var(--text);
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
}

.toast[data-on="1"] { display: flex; }
.toast[data-tone="error"] { border-color: var(--danger); color: var(--danger-deep); }

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--pc-accent);
  animation: pulse 1s ease-in-out infinite;
}

.toast[data-tone="error"] .dot,
.toast[data-tone="done"] .dot { animation: none; }
.toast[data-tone="error"] .dot { background: var(--danger); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}

@media (prefers-reduced-motion: reduce) {
  .dot { animation: none; }
  .act { transition: none; }
}
`;
