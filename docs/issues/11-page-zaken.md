# Issue 11 — Page body: Zaken

**Phase:** 3 · **Depends on:** 04 · **Read first:** [EPIC.md](./EPIC.md), [ADR-0002](../adr/0002-reskin-to-nlds-defaults-no-override-css.md)

## Templates

`src/app/zaken/templates/`:
- `zaken.mustache` (overview), `zaken-table.mustache`, `zaak-row.mustache`
- `singlezaak.mustache`, `zaak.mustache`
- `taken.mustache` (shared taken partial — see issue 08; coordinate if edited)

Note: `zaken-table.mustache` / `zaak-row.mustache` are also embedded on **Home** (issue 06).
Changing them affects both pages — update Home's `<td>zaaktype1</td>` assertion accordingly.

## Scope

- Grid → `nijmegen-grid`/`nijmegen-g-col-*`; `<main id="main">`; shared Side navigation (reuse
  issue 06 markup).
- Zaken **table** → `@gemeentenijmegen/semantic-html` table styling (or NLDS table). Preserve columns,
  ordering, and the per-row link into a single zaak. If keeping `<td>`/`<tr>` semantics, the Home
  `<td>zaaktype1</td>` assertion can stay; otherwise update it.
- Single zaak detail (`singlezaak`/`zaak`): status/steps → NLDS `nijmegen-steplist` where it matches
  the current status timeline; metadata → `nijmegen-metadata` / description list. Preserve all fields,
  documents list, and actions.
- Keep inline SVG icon partials (`file-multiple`, `checkmark`, etc.).

## Tests

- `src/app/zaken/tests/*` — update template assertions to the new markup.
- `src/app/home/tests/home.test.ts` — reconcile the `<td>zaaktype1</td>` assertion with the new
  table markup (this issue and issue 06 share the table partials).
- `test/playwright/endtoend.spec.ts` navigates to Uitkeringen/zaken via the Side navigation — ensure
  its selectors still resolve after issue 06's side-nav change.

## Acceptance criteria

- Preview: `zaken.html` overview and `singlezaak.html` render with parity in NLDS styling; the zaken
  table is readable and each row links to its zaak.
- Home still renders the embedded zaken table correctly after the shared partial change.
- No Bootstrap classes remain in the converted templates.
