# Issue 12 — Cleanup: tighten CSP, remove dead CSS, finalise side-nav

**Phase:** 4 (cleanup) · **Depends on:** 04b + all page issues (05–11) merged · **Read first:** [EPIC.md](./EPIC.md), [ADR-0001](../adr/0001-adopt-nlds-as-sole-frontend-styling.md)

## Why

Legacy CDN links and Bootstrap/MDB JS were already removed from the templates in issue 04b.
This issue closes out the migration by tightening the CSP (which requires a `development` deploy
to verify) and removing the now-dead CSS that accumulated in `screen.css`.

## Scope

1. **Delete dead CSS**: prune `src/app/static-resources/static/styles/screen.css` — remove all
   Bootstrap/MDB overrides and any surviving `nijmegen-*`/`utrecht-*` reach-ins. Keep only rules
   that legitimately belong in `app.css` (bespoke app components), and fold/remove `screen.css`
   accordingly. Remove `*.orig` files (`zaak.css.orig`, etc.) if unused.
2. **Tighten the CSP** in `src/CloudfrontStack.ts` (`cspHeaderValue()`): remove
   `https://componenten.nijmegen.nl` from `connect-src`, `style-src`, `script-src`, `font-src`,
   `img-src`; remove `fonts.googleapis.com`/`fonts.gstatic.com`; drop the inline-style `sha256-...`
   hashes if the inline styles they covered are gone. Keep `'self'`, `data:` (data-URI logo), and
   siteimprove entries. Result should be `default-src 'self'` + `data:`/siteimprove only.
3. **Remove vendored side-navigation** (issue 03) *only if* `@gemeentenijmegen/components-css` has
   published the component by now: swap the vendored import for the package. If not yet published,
   leave the vendored file + `VENDORED` marker in place and note it in the PR.

## Verification (CSP cannot be checked in the `file://` preview)

- Deploy to the `development` environment and load each page. Open the browser console and confirm
  **no CSP violations** (watch especially the web-component Shadow-DOM styling via constructable
  stylesheets, and the data-URI logo).
- Run the Playwright E2E (`test/playwright/endtoend.spec.ts`) against `development` — the full
  DigiD-simulator login → navigate flow must pass.
- Confirm no request goes to `componenten.nijmegen.nl` or Google Fonts (network tab).

## Acceptance criteria

- No `componenten.nijmegen.nl` or Google-Fonts references anywhere in `src/` (templates already
  clean from 04b; this confirms no drift crept in during 05–11).
- CSP is tightened and shows no console violations on `development`.
- All pages render fully styled from `/static` assets only.
- Jest suite and Playwright E2E pass.
- `screen.css` removed or reduced to legitimate `app.css` content only.
