# Issue 04 — Chrome: Header, Footer, Breadcrumbs (+ app.css)

**Phase:** 2 (chrome) · **Depends on:** 01, 02 · **Read first:** [EPIC.md](./EPIC.md), [ADR-0002](../adr/0002-reskin-to-nlds-defaults-no-override-css.md), [CONTEXT.md](../../CONTEXT.md)

## Why

`header.mustache`, `footer.mustache`, `breadcrumbs.mustache` are partials included by **every**
page (registered in `src/shared/render.ts`). Converting them flips the chrome on all pages at once.
This is expected and unavoidable (shared partials). **Bootstrap/MDB and the legacy CDN stay loaded**
in this issue — page bodies are still Bootstrap until their own issues land (ADR-0001).

## Header — use the "Mijn omgeving" (account) variant

Source of truth for markup: `HeaderStoryHtml` in
`/workspace/design-system/packages/storybook/src/components/Header/Html/Header.tsx`
(`variant='account', account=true`), and `/workspace/nijmegen-nlds-templates-examples/home.html`.

Rewrite `src/shared/header.mustache` to:

- Keep the `<!doctype html>`, `<head>`, `<title>`, meta, xsrf, and existing `/static/styles/ds.css`
  link and `{{{header_additions}}}`. **Keep** the legacy CDN `<link>`s for now (removed in issue 12).
- Use the NLDS body/skip-link pattern: `<body class="... utrecht-document ...">`, a
  `nijmegen-skip-link` to `#main`.
- Render `<nijmegen-header>` with the **account** composition:
  - Brand as the **inline data-URI SVG** from the story (this removes the `componenten.nijmegen.nl`
    beeldmerk `<img>`).
  - Mobile region: `<nijmegen-mobile-menu>` + `<nijmegen-toolbar-button>` menu toggle.
  - `nijmegen-header__actions` containing an **account** action (`nijmegen-header-item`,
    `aria-label="Account"`) showing `{{volledigenaam}}`, expanding a **dropdown** panel
    (`nijmegen-header__panel`) that contains **Uitloggen** (`href="/logout"`) and the
    **nijmegen.nl** link. **Omit the search action** entirely.
- Preserve the existing `{{#shownav}}` gating: when not logged in (login/logout/error pages),
  render a **bare** header (brand only, no account action / mobile menu).
- Add a stable `data-test` attribute to the account/logout control (Playwright uses it later).

## Footer — `nijmegen-footer`

Rewrite `src/shared/footer.mustache`:

- Use the NLDS footer markup (the current footer already uses `nijmegen-footer` classes — align it
  fully with the example's `home.html` footer).
- **Remove** the jQuery/popper/bootstrap/MDB `<script>`s **only if** nothing still needs them;
  since Bootstrap CSS stays until issue 12, keep the MDB/bootstrap JS for now **only if** an
  unconverted page body relies on JS behavior (most don't). Prefer removing jQuery/popper/MDB JS
  here if pages don't use JS widgets — verify in the preview harness. If unsure, keep them and let
  issue 12 remove them.
- Add `<script defer src="/static/js/web-components/nijmegen-header.js">` and the mobile-menu and
  toolbar-button bundles (from issue 02). Keep `/static/js/updateFrontend.js`.

## Breadcrumbs

Rewrite `src/shared/breadcrumbs.mustache` to the NLDS `nijmegen-breadcrumb` / semantic-html
breadcrumb markup (see example pages). Keep the same data inputs it currently consumes.

## app.css (create, minimal)

Create `src/app/static-resources/static/styles/app.css` and link it from the header **after**
`ds.css`. This holds **only** styling for app-specific components with no NLDS equivalent (ADR-0002).
In this issue it may be empty or near-empty; later issues (05 login-selector) add to it. Do **not**
put any rule here that targets an `nijmegen-*`/`utrecht-*` class.

## Wrap `<main>`

Ensure every page's `<main>` gets the id `#main` (skip-link target) and the NLDS page-body class
where appropriate (`utrecht-page-body`). If the individual page templates own the `<main>` tag,
this is coordinated per-page issue; ensure the skip-link target exists on at least the chrome level.

## Acceptance criteria

- Preview harness: on every page the new Header + Footer render; logged-in pages show the account
  action with `{{volledigenaam}}` and a working (JS-toggled) dropdown containing Uitloggen + nijmegen.nl.
- Login/logout/error pages show the bare (brand-only) header via `{{#shownav}}` gating.
- The beeldmerk is the inline data-URI SVG; no `componenten.nijmegen.nl` image is used for the brand.
- Web-component JS loads from `/static/js/web-components/...`.
- Page **bodies** are visually unchanged (still Bootstrap) — only chrome changed.
- Legacy CDN `<link>`s are still present (removed in issue 12).
- Update any Jest assertions on header/footer content; add `data-test` on the logout control.

## Guardrails

- No override CSS against NLDS classes (ADR-0002).
- Do not remove the CDN or tighten CSP here.
