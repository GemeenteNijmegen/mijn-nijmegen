# Issue 06 — Page body: Home

**Phase:** 3 · **Depends on:** 04, 03 · **Read first:** [EPIC.md](./EPIC.md), [ADR-0002](../adr/0002-reskin-to-nlds-defaults-no-override-css.md), [ADR-0003](../adr/0003-vendor-unpublished-side-navigation.md)

## Templates

- `src/app/home/templates/home.mustache` (handler: `homeRequestHandler.ts`)
- Partials it pulls in: `src/app/zaken/templates/{taken,zaken-table,zaak-row}.mustache`,
  `src/shared/{arrow-right,spinner}.mustache`.

## Scope

Preserve the page's structure exactly (parity): left **Side navigation**, right main column with
the contactgegevens notice, "Belangrijke taken", "Mijn zaken", and "Andere portalen".

- Layout: `container` + `row` + `col-lg-3 / col-lg-9` → `nijmegen-grid` / `nijmegen-g-col-*`.
- **Side navigation**: replace the old `nav.nijmegen-sidenav` markup with the NLDS component
  vendored in issue 03: `.nijmegen-side-navigation` > `__list` > `__item` > `__link`
  (`__link--current` for the active item, `__link-label` for text). Match the storybook example
  `origin/feat/side-navigation:.../Side navigation/Html/example.html`. Keep the same nav items and
  order from `homeRequestHandler.ts` / `Navigation.ts`. Add a `data-test` hook — Playwright currently
  selects `.nijmegen-sidenav`; update `test/playwright/endtoend.spec.ts` to the new selector.
- **Contactgegevens notice** (`alert alert-info`): convert to the NLDS notice/alert pattern used in
  the examples (do not keep Bootstrap `alert-*`). Preserve the text and the "Contactgegevens
  doorgeven" link.
- **"header-readmore"** (section heading + right-aligned "Bekijk alle … →" link): this small
  pattern has no direct NLDS component — keep it as a bespoke app component; its CSS moves to
  `app.css` (namespaced). Reuse the NLDS heading/link inside it.
- **"Andere portalen"** already uses `nijmegen-link-list` — keep it (it is NLDS).
- Loading states (`{{#timeout}}` spinner text) — preserve behavior.

## Tests

- `src/app/home/tests/home.test.ts` — keep the content assertions (`'Mijn Nijmegen'`); update the
  structural `<td>zaaktype1</td>` expectation if the embedded zaken-table markup changes
  (coordinate with issue 11 if that partial is shared/edited).
- `test/playwright/endtoend.spec.ts` — update `.nijmegen-sidenav` → the new side-navigation selector
  / `data-test`.

## Acceptance criteria

- Preview `home.html`: same sections in the same order; Side navigation renders via the NLDS
  component with the correct current item highlighted; notice, task/zaken sections, and portalen list
  all present and styled in NLDS.
- No Bootstrap grid/alert classes remain in `home.mustache`.
- `header-readmore` styling is only in `app.css`; no `nijmegen-*`/`utrecht-*` overrides.
