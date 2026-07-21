# Issue 05 — Page bodies: Login & Logout

**Phase:** 3 · **Depends on:** 04 · **Read first:** [EPIC.md](./EPIC.md), [ADR-0002](../adr/0002-reskin-to-nlds-defaults-no-override-css.md)

## Templates

- `src/app/login/templates/login.mustache` (handler: `loginRequestHandler.ts`)
- `src/app/logout/templates/logout.mustache`

## Scope

Convert the page bodies from Bootstrap to NLDS while preserving content/structure (parity):

- Layout: `container/row/col-*` → `nijmegen-grid` / `nijmegen-g-col-*`; page body wrapper
  `utrecht-page-body`, `<main id="main">`.
- Headings/paragraphs → `utrecht-heading-*` / `utrecht-paragraph`; links → `utrecht-link`.
- **Login-method selector** (DigiD / Yivi / eHerkenning buttons — `.login-selector`, `.btn-digid`,
  `.btn-yivi`, `.btn-eherkenning`, using `static/images/{digid,eherkenning,yivi}.svg`): this is a
  **bespoke app component** with no NLDS equivalent. Rebuild it with clean semantic markup and move
  its styling into `src/app/static-resources/static/styles/app.css`, namespaced (e.g. `.mijn-login-*`).
  Keep the anchors' `href`s unchanged — Playwright selects `a[href*="digid"]` (do not break it).

## Tests

- `src/app/login/tests/login.test.ts` — update any content assertions that reference old markup.
- Do not change the DigiD `href` used by `test/playwright/endtoend.spec.ts`.

## Acceptance criteria

- Preview: `login.html` and `logout.html` show the same content/actions as before, styled in NLDS,
  with the bare (brand-only) header.
- Login buttons still link to the same DigiD/Yivi/eHerkenning targets.
- Login-selector styling lives only in `app.css`, no rules targeting `nijmegen-*`/`utrecht-*`.
- Bootstrap grid/classes no longer used in these two templates.
