/**
 * Plugin PostCSS que adapta o CSS do BoardUI/Tailwind para viver dentro do
 * shadow root fechado da barra do PageClip, que é injetada em qualquer site.
 *
 * Três coisas não funcionam lá dentro do jeito que o Tailwind gera:
 *
 *   1. `:root` — dentro de um shadow root quem faz esse papel é `:host`. Os
 *      tokens do BoardUI (theme.css) ficariam sem valor.
 *   2. `@property` — o Chrome só registra propriedades declaradas no
 *      documento; as de um shadow root são ignoradas, e utilitários como
 *      `shadow-*` e `ring-*` perdem o valor inicial e somem. Viram declarações
 *      comuns numa camada que os utilitários sobrescrevem.
 *   3. `rem` — mede pelo `<html>` do site. Um site com `font-size: 62.5%`
 *      encolheria a barra inteira. Viram `px` (1rem = 16px).
 */

const REM = /(-?\d*\.?\d+)rem\b/g;

function remToPx(value) {
  return value.replace(REM, (_, number) => `${round(Number(number) * 16)}px`);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

export default function shadowCss() {
  return {
    postcssPlugin: 'pageclip-shadow-css',
    OnceExit(root, { Rule, AtRule }) {
      const local = [];
      const inherited = [];

      root.walkAtRules('property', (rule) => {
        let initial = null;
        let inherits = false;
        rule.walkDecls((decl) => {
          if (decl.prop === 'initial-value') initial = decl.value;
          if (decl.prop === 'inherits') inherits = decl.value.trim() === 'true';
        });
        if (initial !== null) (inherits ? inherited : local).push([rule.params.trim(), initial]);
        rule.remove();
      });

      root.walkRules((rule) => {
        if (!rule.selector.includes(':root')) return;
        const selectors = rule.selectors.map((selector) => selector.replace(/:root\b/g, ':host'));
        rule.selectors = [...new Set(selectors)];
      });

      root.walkDecls((decl) => {
        if (decl.value.includes('rem')) decl.value = remToPx(decl.value);
      });

      if (!local.length && !inherited.length) return;

      // Mesma camada que o Tailwind usa para o próprio fallback de @property.
      // A ordem das camadas é a da primeira menção: declarar no topo garante
      // que ela vem antes de todas e que qualquer utilitário vence.
      root.prepend(new AtRule({ name: 'layer', params: 'properties' }));
      const layer = new AtRule({ name: 'layer', params: 'properties' });
      if (local.length) {
        const rule = new Rule({ selector: ':host, *, ::before, ::after, ::backdrop' });
        for (const [prop, value] of local) rule.append({ prop, value });
        layer.append(rule);
      }
      if (inherited.length) {
        const rule = new Rule({ selector: ':host' });
        for (const [prop, value] of inherited) rule.append({ prop, value });
        layer.append(rule);
      }
      root.append(layer);
    }
  };
}

shadowCss.postcss = true;
