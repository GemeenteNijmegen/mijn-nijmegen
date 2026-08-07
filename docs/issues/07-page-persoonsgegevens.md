# Issue 07 — Page body: Persoonsgegevens

**Phase:** 3 · **Depends on:** 04 · **Read first:** [EPIC.md](./EPIC.md), [ADR-0002](../adr/0002-reskin-to-nlds-defaults-no-override-css.md)

## Templates

`src/app/persoonsgegevens/templates/`:
- `persoonsgegevens.mustache`
- `mijngegevens.mustache`
- `contactgegevens.mustache`
- `edit-contactgegevens.mustache`
- `verify-contactgegevens.mustache`

## Scope

Convert each template's body to NLDS, preserving content/structure (parity):

- Grid: `container/row/col-*` → `nijmegen-grid`/`nijmegen-g-col-*`; the page shares the Home layout
  with the **Side navigation** on the left — reuse the same NLDS side-navigation markup as issue 06.
- Data display (`.card-number`, `.contact .items`, definition rows) → NLDS `nijmegen-card` /
  semantic-html table / description-list markup as appropriate. Match the examples; accept NLDS
  default spacing (ADR-0002).
- **Forms** (`edit-contactgegevens`, `verify-contactgegevens`, `md-form` labels/inputs): convert to
  Utrecht form components (`utrecht-form-field`, `utrecht-textbox`, `utrecht-button`,
  `utrecht-button-group`). Preserve field names, validation hooks
  (`static/js/form-validation.js`), and the xsrf token field.
- Icons currently inlined via `src/shared/*.mustache` partials (e.g. `address-book`,
  `currency-eur`) — keep as inline SVG partials (they are app assets, not CDN).

## Tests

- `src/app/persoonsgegevens/tests/persoongegevensTemplate.test.ts` — the negative assertions
  `not.toMatch('<h2>Er is iets misgegaan</h2>')` should still hold (keep that error heading text
  intact). Update any positive structural assertions.

## Acceptance criteria

- Preview: `persoonsgegevens.html`, `mijngegevens.html`, `contactgegevens.html`, and the edit/verify
  forms render with parity, styled in NLDS, forms still submit the same fields with xsrf + validation.
- No Bootstrap grid/card/`md-form` classes remain in these templates.
- No override CSS against NLDS classes.
