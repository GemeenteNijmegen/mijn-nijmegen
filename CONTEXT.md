# Mijn Nijmegen

Citizen-facing personal portal ("Mijn omgeving") for the municipality of Nijmegen, where a logged-in resident views their persoonsgegevens, uitkeringen, zaken, taken, and producten. Pages are rendered server-side (Mustache) inside AWS Lambda.

## Language

**Mijn omgeving**:
The logged-in personal-portal context — the whole of Mijn Nijmegen once a user has authenticated. Names the NLDS header variant (`account`) used for this app.

**Header**:
The global page chrome at the top of every page: brand, the account action (user name → logout), and the nijmegen.nl link. Carries no section navigation.
_Avoid_: navbar, top nav.

**Side navigation**:
The in-page navigation that lists the app's sections (Home, Persoonsgegevens, Zaken, Uitkeringen, …). Distinct from the Header; rendered per page.
_Avoid_: sidenav, menu, navbar.
