# Issue 02 — Web-component JS delivery ✅

**Status: Done** · **Phase:** 1 (foundation) · **Depends on:** 01 · **Read first:** [EPIC.md](./EPIC.md)

## Why

The Header (issue 04) uses NLDS **web components** (`<nijmegen-header>`, `<nijmegen-mobile-menu>`,
`<nijmegen-toolbar-button>`). Their JS must be self-hosted and served from `/static` (never from
unpkg in production). The bundles are already built as **IIFE** (classic scripts) in the npm
package, so they work over `file://` and under the existing `script-src 'self'` CSP.

## Scope

1. Add `@gemeentenijmegen/web-components` as a dependency via `.projenrc.ts`, then `npx projen`.
2. Add a projen **copy** task (parallel to `bundle:css-bundle`, spawned by compile) that copies the
   prebuilt bundles from `node_modules/@gemeentenijmegen/web-components/dist/*.js` into
   `src/app/static-resources/static/js/web-components/`. **Copy the prebuilt IIFE files as-is** —
   do not re-bundle them through esbuild (that risks their Shadow-DOM assumptions).
   Needed for this app: `nijmegen-header.js`, `nijmegen-mobile-menu.js`, `nijmegen-toolbar-button.js`.
   (`nijmegen-search.js` is **not** needed — search is omitted, see issue 04.)
3. Add the copied path(s) to the `gitignore` list in `.projenrc.ts` (generated output).

The `<script defer>` references themselves are added to the footer in issue 04, not here.

## Acceptance criteria

- After compile, `src/app/static-resources/static/js/web-components/nijmegen-header.js` (and the
  mobile-menu, toolbar-button bundles) exist.
- Files are byte-for-byte the package's dist output (IIFE), not re-bundled.
- The copy runs automatically as part of the build (spawned by the compile task).

## Guardrails

- Only copy the three components this app uses; do not pull in search/mega-menu.
- No CSP change here (self-hosted scripts already satisfy `script-src 'self'`).
