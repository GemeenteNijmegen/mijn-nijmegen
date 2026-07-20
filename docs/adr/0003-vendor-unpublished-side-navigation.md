# Vendor the unpublished NLDS side-navigation as a tracked interim

The home page's section navigation uses the NLDS **side-navigation** component. That component exists only on the unmerged, unpublished `feat/side-navigation` branch of the design-system (last touched April 2026, ahead of but also behind `main`); its **design tokens (`--denhaag-side-navigation-*`) are already published** in `@gemeentenijmegen/design-tokens`, only the ~96-line CSS component is not.

Rather than defer the home page on an external merge with no committed timeline, or ship an interim `link-list` and convert the page twice, we **vendor** the component's `index.scss` into our CSS bundle. It is NLDS source (not a bespoke override — consistent with [0002](./0002-reskin-to-nlds-defaults-no-override-css.md)) and the tokens are already published, so it produces the real component, built locally for now.

The vendored file carries a `VENDORED FROM feat/side-navigation` marker and a tracking issue, to be replaced by `@gemeentenijmegen/components-css` once the component is merged and published.

## Status

Interim — remove when the side-navigation component is published upstream.
