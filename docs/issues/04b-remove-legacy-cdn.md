# Issue 04b — Remove legacy CDN, Bootstrap CSS, and JS ✅

**Status: Done** · **Phase:** 2 (chrome) · **Depends on:** 04 · **Read first:** [EPIC.md](./EPIC.md), [ADR-0001](../adr/0001-adopt-nlds-as-sole-frontend-styling.md)

## Why

Issue 04 left the legacy CDN links in place so the chrome PR could stay focused. Now that the
chrome is converted, there is no reason to keep Bootstrap or the `componenten.nijmegen.nl` CDN
loaded. Removing them **before** page body work (05–11) forces each page-body issue to stand on
its own: if a page relies on Bootstrap grid or MDB styles, it is visibly broken and the issue
must fix it. This is preferable to the old "remove at the end" strategy, which risked shipping
"converted" bodies that silently still depended on legacy CSS. See EPIC.md guardrail #3.

## Scope

All changes are in `src/shared/header.mustache` and `src/shared/footer.mustache`.

### header.mustache — remove

- All `<link>` tags pointing to `https://componenten.nijmegen.nl/` (Bootstrap CSS, nijmegen.css,
  nijmegen-nlds.min.css, or any other path under that domain).
- The Google Fonts `<link rel="preload">` / `<link rel="preconnect">` to `fonts.googleapis.com`
  and `fonts.gstatic.com` (fonts are now self-hosted via `@gemeentenijmegen/font` in `ds.css`).
- Any manual `@font-face` preload `<link>` tags for Oranda BT / Source Sans Pro (same reason).

Keep the `<link rel="stylesheet" href="/static/styles/ds.css">` and
`<link rel="stylesheet" href="/static/styles/app.css">` — those are the NLDS bundle.

### footer.mustache — remove

- `<script>` tags for jQuery, Popper, Bootstrap JS, MDB JS, and `nijmegen.js` (whether loaded
  from `componenten.nijmegen.nl` or any other CDN origin).
- Any remaining `componenten.nijmegen.nl` script references.

Keep `/static/js/updateFrontend.js` and the web-component `<script defer>` tags added in issue 04.

## Acceptance criteria

- No request goes to `componenten.nijmegen.nl` or Google Fonts on any preview page (network tab).
- `preview/login.html` and `preview/logout.html` still render — these use the bare (brand-only)
  header so they never depended on the account variant.
- Other pages (`home.html`, `zaken.html`, …) may look visually broken (body content without
  Bootstrap grid) — this is **expected** and will be fixed in issues 05–11. Verify the page
  **loads without JS errors** and the chrome (header, footer, breadcrumbs) remains intact.
- CSP is **not** tightened here (no `componenten.nijmegen.nl` entry removed from
  `CloudfrontStack.ts`) — that is issue 12. Reason: the CSP tightening requires a `development`
  deploy to verify; this issue only touches templates.

## Guardrails

- No page-body template changes in this issue — that belongs to issues 05–11.
- Do not tighten the CSP here; leave `CloudfrontStack.ts` untouched.
- Do not remove `screen.css` yet; that is issue 12.
