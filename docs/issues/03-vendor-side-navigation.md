# Issue 03 — Vendor the side-navigation component

**Phase:** 1 (foundation) · **Depends on:** 01 · **Read first:** [EPIC.md](./EPIC.md), [ADR-0003](../adr/0003-vendor-unpublished-side-navigation.md)

## Why

The Home page's **Side navigation** (see CONTEXT.md) uses the NLDS side-navigation component, which
is **not yet published** — it lives only on the design-system branch `feat/side-navigation`. Its
**design tokens are already published** in `@gemeentenijmegen/design-tokens` (`--denhaag-side-navigation-*`),
so we only need to vendor the CSS. This is an interim; it gets removed when the component publishes.

## Scope

1. Copy the component CSS from the design-system branch into this repo, e.g.
   `src/app/static-resources/static/styles/vendor/side-navigation.scss` (or `.css`). Source:
   ```
   git -C /workspace/design-system show origin/feat/side-navigation:packages/components-css/side-navigation/index.scss
   ```
   The component depends on `@utrecht/focus-ring-css` mixins (already available) and the published
   `--denhaag-side-navigation-*` tokens — no token changes needed.
2. Import the vendored file from `ds-input.js` so it lands in `ds.css`.
3. At the top of the vendored file, add a marker comment:
   `/* VENDORED FROM design-system feat/side-navigation — replace with @gemeentenijmegen/components-css once published. Tracking: <issue link> */`
4. Open/track an upstream issue to replace this, and note it in the marker.

The markup that consumes it (`.nijmegen-side-navigation` / `__list` / `__item` / `__link` /
`__link-label` / `__link--current`) is written in the Home issue (06), matching the storybook
example at `origin/feat/side-navigation:.../Side navigation/Html/example.html`.

## Acceptance criteria

- `ds.css` contains the `.nijmegen-side-navigation*` rules after build.
- The vendored file carries the `VENDORED` marker and a tracking-issue reference.
- No design-token edits were needed (tokens already published).

## Guardrails

- This is NLDS source, not a bespoke override — do **not** modify the component's styling to match
  the old sidenav (ADR-0002). Vendor it verbatim.
