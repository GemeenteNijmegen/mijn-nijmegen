# Issue 01 — NLDS dependencies & CSS bundle ✅

**Status: Done** · **Phase:** 1 (foundation) · **Depends on:** 00 · **Read first:** [EPIC.md](./EPIC.md), [ADR-0001](../adr/0001-adopt-nlds-as-sole-frontend-styling.md)

## Why

Bring the full NLDS CSS/token/font set into the local bundle so the converted markup in later
issues has styling to hook onto. This issue only expands what `ds.css` contains — it does **not**
touch templates or remove the legacy CDN (that is issue 12).

## Scope

1. In `.projenrc.ts`, add/bump these as dependencies (published npm versions), then run `npx projen`:
   - `@gemeentenijmegen/design-tokens`, `@gemeentenijmegen/layout-css`,
     `@gemeentenijmegen/components-css` (latest published, ≥ 0.1.6).
   - **New:** `@gemeentenijmegen/semantic-html`, `@gemeentenijmegen/font`.
   - The `@utrecht/*` primitives used by the example pages that aren't already present —
     compare against `/workspace/nijmegen-nlds-templates-examples/home.html` `<link>` list:
     at least `@utrecht/page-body-css`, `@utrecht/rich-text-css`, `@utrecht/pre-heading-css`,
     `@utrecht/link-css` (heading/button/paragraph/document are already present).
2. Update `src/app/static-resources/static/styles/ds-input.js` to import the added stylesheets
   (mirror the example page's stylesheet set). Include `@gemeentenijmegen/font/dist/index.css`
   (self-hosts Oranda BT + Source Sans Pro).
3. Ensure the esbuild `bundle:css-bundle` task still produces
   `src/app/static-resources/static/styles/ds.css`. If `@gemeentenijmegen/font`'s CSS references
   `url(...)` font files, make esbuild emit/copy those assets (add a font loader or a copy step)
   so the fonts resolve under `/static/styles/`. Verify no build error and the output CSS is larger.

## Acceptance criteria

- `npx projen build` (or the compile task) succeeds and regenerates `ds.css`.
- In the preview harness, pages still render; NLDS component classes (e.g. `nijmegen-card`,
  `utrecht-button`, `nijmegen-grid`) now have styling available (spot-check by temporarily adding
  one such element, or wait for later issues).
- `@gemeentenijmegen/font` fonts load without hitting Google Fonts.
- No template changes, no CDN removal in this issue.

## Guardrails

- Legacy CDN and Bootstrap remain untouched (ADR-0001 — removed only in issue 12).
- Do not hand-edit `package.json`; go through `.projenrc.ts` + `npx projen`.
