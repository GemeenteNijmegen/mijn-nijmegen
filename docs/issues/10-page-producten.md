# Issue 10 — Page body: Producten

**Phase:** 3 · **Depends on:** 04 · **Read first:** [EPIC.md](./EPIC.md), [ADR-0002](../adr/0002-reskin-to-nlds-defaults-no-override-css.md)

## Templates

- `src/app/producten/templates/producten.mustache`
- `src/app/producten/templates/product.mustache`
- `src/app/producten/templates/wallet.mustache`

## Scope

- Grid → `nijmegen-grid`/`nijmegen-g-col-*`; `<main id="main">`; shared Side navigation (reuse
  issue 06 markup).
- Product list/detail and wallet cards → NLDS `nijmegen-card` / `nijmegen-top-task-card` +
  `utrecht-heading-*` / `utrecht-paragraph` / `utrecht-link`. Preserve each product's content,
  metadata, and actions, and the empty state.
- Keep inline SVG icon partials.

## Tests

- `src/app/producten/tests/{productTemplate,productenTemplate}.test.ts` — the negative assertions
  `not.toMatch('<h2>Er is iets misgegaan</h2>')` must still hold (keep that error heading text).
  Update positive structural assertions to the new markup.

## Acceptance criteria

- Preview: `producten.html` (list), a product detail, and wallet render with parity in NLDS styling.
- No Bootstrap classes remain in the converted templates.
- No override CSS against NLDS classes.
