# EPIC — Convert Mijn Nijmegen frontend to the Nijmegen Design System (NLDS)

## Goal

Migrate the server-rendered (Mustache-in-Lambda) frontend from its current three-layer
hybrid (Bootstrap + MDB + `nijmegen.css v6.5.0` CDN, plus a partial NLDS layer) onto a
single, coherent Nijmegen NL Design System. See the decisions before writing any code:

- [ADR-0001](../adr/0001-adopt-nlds-as-sole-frontend-styling.md) — Pure NLDS is the target; legacy CDN removed at the end.
- [ADR-0002](../adr/0002-reskin-to-nlds-defaults-no-override-css.md) — Re-skin (not redesign); NLDS defaults win; **no override CSS**.
- [ADR-0003](../adr/0003-vendor-unpublished-side-navigation.md) — Vendor the unpublished side-navigation as a tracked interim.
- [CONTEXT.md](../../CONTEXT.md) — canonical terms: **Header** (chrome) vs **Side navigation** (sections), **Mijn omgeving**.

## Reference material (read-only, already on disk)

- Target design system source: `/workspace/design-system` (packages: `components-css`, `web-components`, `components-semantic-html` = npm `@gemeentenijmegen/semantic-html`, `layout-css`; fonts in `proprietary/font`).
- Full example pages using NLDS: `/workspace/nijmegen-nlds-templates-examples/*.html` (e.g. `home.html`).
- Header "Mijn omgeving" markup: `/workspace/design-system/packages/storybook/src/components/Header/Html/Header.tsx` (the `HeaderStoryHtml` export, `variant='account'`, `account=true`).
- Vendored side-navigation source: git branch `origin/feat/side-navigation`, file `packages/components-css/side-navigation/index.scss` in `/workspace/design-system`.

## How this repo builds (important — it uses projen)

- **Do not hand-edit `package.json` or task definitions.** They are generated from `.projenrc.ts`.
  To add a dependency or a build task: edit `.projenrc.ts`, then run `npx projen`.
- CSS is bundled by esbuild from `src/app/static-resources/static/styles/ds-input.js`
  via the `bundle:css-bundle` task (defined in `.projenrc.ts`), which the compile task spawns.
  Output is `src/app/static-resources/static/styles/ds.css` (gitignored), linked from the header.
- Rendering entry point: `src/shared/render.ts` (Mustache; registers `header`, `footer`,
  `breadcrumbs` partials). Templates are `*.mustache` under `src/shared/` and `src/app/*/templates/`.

## Shared conventions & guardrails (apply to every issue)

1. **No override CSS (ADR-0002).** Never add a CSS rule that reaches into an NLDS/Utrecht
   class (`utrecht-*`, `nijmegen-*`) to restyle it toward the old Bootstrap look. If an NLDS
   component exists, use it and accept its default appearance. Only genuinely app-specific UI
   with no NLDS equivalent may get CSS, in a single namespaced `app.css` (see issue 04).
2. **Parity, not pixels (ADR-0002).** Preserve content, section order, hierarchy, links/actions,
   and responsive behavior. "Looks different because it's NLDS now" is expected. "Content missing,
   reordered, or newly broken" is a bug.
3. **Remove-first, then fix (ADR-0001 revised).** The legacy CDN (`componenten.nijmegen.nl`),
   Bootstrap/MDB CSS, and jQuery/popper/MDB JS are removed in **issue 04b** — immediately after
   the chrome lands, before any page body is converted. Page body issues (05–11) therefore start
   from a clean NLDS slate: if something breaks because it depended on Bootstrap, it is visibly
   broken and must be fixed in that issue. This is deliberate; it prevents shipping "converted"
   pages that silently still relied on legacy CSS.
4. **Integrate to `development`** in small PRs, one issue per PR. Hybrid states on the
   `development` environment are acceptable (pages may look unstyled between 04b and their own
   issue); production is untouched.
5. **Verify locally first** using the preview harness from issue 00 (`npx projen preview:watch`,
   open `preview/<page>.html`). Then update the affected Jest content assertions and, where the
   markup a Playwright test touches changes, its selectors (prefer adding `data-test` hooks).
6. **No HTML snapshot tests.** Jest stays content/behavior only.

## Phases & issues

| Phase | Issue | Depends on | Status |
|-------|-------|------------|--------|
| 0 — Tooling | [00 — Local preview harness](./00-preview-harness.md) | — | ✅ Done |
| 1 — Foundation | [01 — NLDS dependencies & CSS bundle](./01-dependencies-and-css-bundle.md) | 00 | ✅ Done |
| 1 — Foundation | [02 — Web-component JS delivery](./02-web-component-js-delivery.md) | 01 | ✅ Done |
| 1 — Foundation | [03 — Vendor side-navigation](./03-vendor-side-navigation.md) | 01 | ✅ Done |
| 2 — Chrome | [04 — Header, footer, breadcrumbs + app.css](./04-chrome-header-footer-breadcrumbs.md) | 01, 02 | ✅ Done |
| 2 — Chrome | [04b — Remove legacy CDN/Bootstrap/JS](./04b-remove-legacy-cdn.md) | 04 | ✅ Done |
| 3 — Page bodies | [05 — Login & logout](./05-page-login-logout.md) | 04b | ✅ Done |
| 3 — Page bodies | [06 — Home](./06-page-home.md) | 04b, 03 | ✅ Done |
| 3 — Page bodies | [07 — Persoonsgegevens](./07-page-persoonsgegevens.md) | 04b | |
| 3 — Page bodies | [08 — Taken](./08-page-taken.md) | 04b | |
| 3 — Page bodies | [09 — Uitkeringen](./09-page-uitkeringen.md) | 04b | |
| 3 — Page bodies | [10 — Producten](./10-page-producten.md) | 04b | |
| 3 — Page bodies | [11 — Zaken](./11-page-zaken.md) | 04b | |
| 4 — Cleanup | [12 — Tighten CSP + dead CSS + side-nav](./12-cleanup-remove-legacy-tighten-csp.md) | 05–11 all done |  |

Phase 3 page issues are independent of each other and may be done in any order/parallel PRs,
but all depend on the chrome (04) being merged first.
