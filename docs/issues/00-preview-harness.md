# Issue 00 — Local preview harness

**Phase:** 0 (tooling) · **Depends on:** none · **Read first:** [EPIC.md](./EPIC.md)

## Why

Everything after this is verified by looking at rendered pages locally before deploy. There is
no dev server today; the only rendering happens as a side-effect of Jest tests writing HTML to
`tests/output/`. Build a small, robust static-snapshot watcher instead. Decision recap: a
**decoupled** preview script (not coupled to Jest pass/fail), **one happy-path fixture per page**,
output **gitignored**, opened over `file://`.

## Scope

Create `src/preview/`:

- `src/preview/fixtures/<page>.ts` (or `.json`) — one happy-path data object per page. Seed the
  values from the existing test mocks (e.g. `src/app/home/tests/home.test.ts`,
  `src/app/zaken/tests/*`, `src/app/persoonsgegevens/tests/*`). Extract the shared
  DynamoDB/Secrets/`fetch` mock setup into a reusable module so tests and preview share it (DRY) —
  do **not** duplicate rendering logic; reuse `src/shared/render.ts` and the existing request
  handlers / template modules.
- `src/preview/render-previews.ts` — for each page, render the full HTML (through the same
  `render()` + partials the Lambda uses) and write it to `preview/<page>.html` with **stable**
  filenames (`home.html`, `zaken.html`, `login.html`, …).
- A **complete** static-path rewrite applied to the rendered HTML so it works from `file://`:
  replace **both** `href="/static` **and** `src="/static` with a relative path to
  `src/app/static-resources/static`, covering CSS, fonts, images, and the web-component `<script>`
  tags. (Today the tests only rewrite `href="/static`, `href`-only — do not copy that; do it fully.)
- A watch script using `chokidar` that re-renders on changes to `**/*.mustache` and `src/preview/**`.

Wire tasks in `.projenrc.ts` (then run `npx projen`):

- `preview` — run `render-previews.ts` once.
- `preview:watch` — run it under chokidar.

Add `preview/` to the `gitignore` list in `.projenrc.ts`.

## Pages to render (happy path each)

`login`, `logout`, `home`, `persoonsgegevens` (+ `mijngegevens`, `contactgegevens`),
`taken`, `uitkeringen`, `producten`, `zaken` (+ `singlezaak`).

## Acceptance criteria

- `npx projen preview:watch` renders all pages above to `preview/*.html` and re-renders on save.
- Opening `preview/home.html` in a browser shows the **current** (pre-migration) page correctly:
  CSS from `/static/styles/ds.css` and the legacy CDN both resolve, fonts/images load.
- Editing any `.mustache` and refreshing the browser reflects the change.
- The harness does **not** import or depend on Jest, and keeps rendering even when tests fail.
- `preview/` is gitignored; nothing under it is committed.

## Out of scope

- No CSP emulation (preview is `file://`, no CSP — CSP is verified on the `development` deploy).
- No visual-regression/screenshot assertions (ADR-0002).
