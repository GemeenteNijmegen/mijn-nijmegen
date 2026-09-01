# Issue 09 — Page body: Uitkeringen

**Phase:** 3 · **Depends on:** 04 · **Read first:** [EPIC.md](./EPIC.md), [ADR-0002](../adr/0002-reskin-to-nlds-defaults-no-override-css.md)

## Templates

- `src/app/uitkeringen/templates/uitkeringen.mustache`
- `src/app/uitkeringen/templates/uitkerings-item.mustache`

## Scope

- Grid → `nijmegen-grid`/`nijmegen-g-col-*`; `<main id="main">`; shared Side navigation (reuse
  issue 06 markup).
- Each uitkerings-item (currently Bootstrap card/table) → NLDS `nijmegen-card` and/or semantic-html
  table (`@gemeentenijmegen/semantic-html` table styling). Preserve all fields, labels, amounts, and
  ordering. Accept NLDS default spacing/typography (ADR-0002).
- Keep currency/icon inline SVG partials (`src/shared/currency-eur.mustache`, etc.).

## Tests

- `src/app/uitkeringen/tests/uitkeringsapi.test.ts` asserts on the **SOAP request** envelope
  (`<soap:Envelope ...>`) — that is API-layer, **not** template markup; do not touch it.
- Update any template-rendering assertions to the new markup.

## Acceptance criteria

- Preview: `uitkeringen.html` shows the same uitkering entries and fields, styled in NLDS.
- No Bootstrap classes remain in the converted templates.
- SOAP/API tests untouched and still passing.
