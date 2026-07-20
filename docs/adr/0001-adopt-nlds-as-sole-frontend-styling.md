# Adopt NLDS as the sole frontend styling system

The frontend currently loads three overlapping styling generations — Bootstrap, MDB, and `nijmegen.css v6.5.0` from the `componenten.nijmegen.nl` CDN — on top of a partial NL Design System (NLDS) layer bundled locally into `ds.css`. We will migrate fully onto the Nijmegen NLDS (`design-tokens`, `font`, `layout-css`, `components-css`, `semantic-html`, `web-components`) and remove all legacy frameworks and the CDN. This gives one coherent system instead of three fighting over the cascade.

The migration is incremental: **remove-first, then fix**. The legacy CDN links and Bootstrap/MDB
JS are removed from the shared partials (`header.mustache`/`footer.mustache`) in issue 04b —
immediately after the chrome is converted and before any page body is converted. Page body issues
(05–11) therefore work from a clean NLDS slate; any implicit Bootstrap dependency surfaces as a
visible break that must be fixed in that issue rather than being masked by a legacy safety net.
The CSP is tightened only in the final cleanup commit (issue 12), because verifying CSP requires
a `development` deploy.

## Consequences

- "Pure NLDS" is only actually true at the end of the migration; transient hybrid states are visible on the `development` branch environment (never production).
