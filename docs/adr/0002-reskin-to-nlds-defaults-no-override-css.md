# Re-skin to NLDS defaults, not a redesign; no override CSS

The conversion is a **re-skin**, not a redesign: each page keeps its content, structure, hierarchy, links/actions, and responsive behavior. We swap the markup vocabulary (Bootstrap `container/row/col-*`, `card`, `alert-*`) for NLDS/Utrecht components, and we **accept NLDS visual defaults** even where they differ from the old Bootstrap look. Per-page acceptance is *"no content is lost, reordered, or newly broken"* — not pixel-parity.

We do **not** add CSS that reaches into an NLDS or Utrecht component to restyle it back toward the old design — that would rebuild the very hybrid we are removing (see [0001](./0001-adopt-nlds-as-sole-frontend-styling.md)). App-specific UI that NLDS genuinely lacks (the login-method selector, the "section header + *see all*" pattern) keeps a small, clearly-namespaced `app.css`. The test for legal CSS: *does a matching NLDS component exist?* If yes, use it and don't touch it; if no, build it as an app component.

## Consequences

- Pages will look different from the old Bootstrap version. That is expected, not a bug.
- Verification is via a static preview harness (structure/content) plus Jest content assertions and Playwright flows — **no** rendered-HTML snapshot or visual-regression gate, which would thrash on every intentional change.
