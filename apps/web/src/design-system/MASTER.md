# Design System — Radar de Licitações (PNCP)

Fonte única de verdade para regras de UI/UX. Uso: priorizar regras de página em `design-system/pages/<page>.md` quando existirem; caso contrário, usar apenas este arquivo.

## Produto e estilo

- **Produto:** Ferramenta moderna (SaaS) — limpo, atual, foco em produtividade (painel de licitações PNCP).
- **Identidade:** Primária teal (#0f766e), fonte Satoshi. Manter; refinar apenas contraste, espaçamento e estados.

## Tokens (tema)

- **Cores semânticas:** `primary`, `secondary`, `error`, `success`, `info`, `background.default`, `background.paper`, `text.primary`, `text.secondary`. Usar tokens do tema; evitar hex direto em componentes.
- **Contraste:** Texto normal ≥ 4.5:1 (AA); texto grande ≥ 3:1. Light e dark testados.
- **Escala de espaçamento:** 4/8px (base 8). Preferir `theme.spacing(n)` (múltiplos de 8).
- **Z-index:** Usar `zIndexScale` de `@/theme/portal-editals-theme`: base 0, sidebar 10, main 20, sticky 40, dropdown 100, modal 1000.

## Acessibilidade (prioridade 1–2)

- **Focus:** Anel de foco visível 2–4px em todos os interativos (tema: MuiButtonBase).
- **Touch:** Área mínima 44×44px para ícones e botões (tema: MuiIconButton).
- **Labels:** Campos com label visível associado; não depender só de placeholder.
- **ARIA:** Botões só-ícone com `aria-label`; navegação com `aria-current` onde aplicável.
- **Teclado:** Ordem de tab = ordem visual; suporte completo a teclado.
- **Reduced motion:** Respeitar `prefers-reduced-motion` em animações.

## Visual e consistência (prioridade 4–6)

- **Hierarquia:** Títulos (h1–h6), body1/body2; peso 700 títulos, 500 labels, 400 body.
- **Estados:** Hover/focus/disabled visíveis e consistentes; não mudar layout nos estados.
- **Elevação:** Escala de sombras do tema; evitar valores arbitrários.
- **Navegação:** Item ativo destacado (cor, peso ou borda); espaçamento 8px entre itens.

## Anti-padrões a evitar

- Emoji como ícone; usar SVG/ícones MUI.
- Placeholder como único label de campo.
- Áreas de toque &lt; 44px sem hitSlop/padding.
- Remover ou esconder anel de foco.
- Cores hardcoded em componentes em vez de tokens do tema.
