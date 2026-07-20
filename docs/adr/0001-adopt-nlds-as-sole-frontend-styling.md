# Adopt NLDS as the sole frontend styling system

The frontend currently loads three overlapping styling generations — Bootstrap, MDB, and `nijmegen.css v6.5.0` from the `componenten.nijmegen.nl` CDN — on top of a partial NL Design System (NLDS) layer bundled locally into `ds.css`. We will migrate fully onto the Nijmegen NLDS (`design-tokens`, `font`, `layout-css`, `components-css`, `semantic-html`, `web-components`) and remove all legacy frameworks and the CDN. This gives one coherent system instead of three fighting over the cascade.

The migration is incremental: both the legacy and NLDS layers **coexist** while pages are converted one at a time. Because the CDN links live in shared partials (`header.mustache`/`footer.mustache`), the CDN and the Google-Fonts preload are removed — and the CSP tightened — only in the **final cleanup commit**, once no page depends on them.

## Consequences

- "Pure NLDS" is only actually true at the end of the migration; transient hybrid states are visible on the `development` branch environment (never production).
