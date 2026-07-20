# Issue 08 — Page body: Taken

**Phase:** 3 · **Depends on:** 04 · **Read first:** [EPIC.md](./EPIC.md), [ADR-0002](../adr/0002-reskin-to-nlds-defaults-no-override-css.md)

## Templates

- `src/app/taken/templates/taken.mustache`
- Note: there is also `src/app/zaken/templates/taken.mustache` (a taken **partial** used by Home
  and Zaken). If this issue touches the shared partial, coordinate with issues 06 and 11 so its
  markup change lands once and their assertions are updated together.

## Scope

- Grid → `nijmegen-grid`/`nijmegen-g-col-*`; `<main id="main">` / `utrecht-page-body`; shared
  Side navigation (reuse issue 06 markup).
- Task list/cards → NLDS `nijmegen-card` (or `nijmegen-toptask-card` where it matches the current
  "task to handle" affordance) + `utrecht-heading-*` / `utrecht-link`. Preserve each task's title,
  metadata, and link/action, and the empty/loading states.
- Keep `src/shared/tasks.mustache` / icon partials as inline SVG.

## Tests

- Update content assertions in the taken tests if present; keep task titles/labels text stable.

## Acceptance criteria

- Preview: `taken.html` shows the same task entries and actions as before, in NLDS styling.
- No Bootstrap classes remain in the converted template(s).
- If the shared `zaken/templates/taken.mustache` partial changed, Home and Zaken previews still
  render correctly.
