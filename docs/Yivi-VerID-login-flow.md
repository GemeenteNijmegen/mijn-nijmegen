# Inloggen met Yivi via VerID

Als `USE_YIVI_VERID=true` en de VeridAuthenticationClient inclusief configuratie correct is, loopt de Yivi-login via VerID in plaats van Signicat. Dit is een OAuth authorization code flow met PKCE (S256). De library `@ver-id/node-client` genereert zelf de `state` en de `code_verifier` en bewaart de verifier in de VERID_CACHE_TABLE, zodat de login- en auth-lambda hem allebei kunnen gebruiken.

Cold start login/auth lambda: verIdAuthenticatorFromEnv() bouwt de client (issuer, clientId, secret uit Secrets Manager, redirectUri, DynamoDBCacheManager TTL 600s).Mislukt dit, dan valt Yivi terug op Signicat (of wordt verborgen).

```mermaid
sequenceDiagram
  autonumber
  actor U as Browser
  participant L as Login lambda (/login)
  participant A as Auth lambda (/auth)
  participant C as @ver-id/node-client
  participant VC as DynamoDB VERID_CACHE_TABLE
  participant S as DynamoDB sessions table
  participant V as VerID
  participant Y as Yivi app

  U->>L: GET /login?method=yivi
  L->>S: session.init() (al ingelogd: redirect /)
  L->>C: VerIdAuthenticator.start(): createSession({scope: "openid nin"})
  C->>C: code_verifier = oauth4webapi.generateRandomCodeVerifier()<br/>code_challenge = S256(code_verifier)
  C->>V: createIntent(client_id, code_challenge, scope) + client secret
  V-->>C: intent_id
  C->>C: state = generateRandomState()
  C->>VC: save(state → code_verifier)
  C-->>L: { url, state }
  L->>S: createSession(loggedin=false, state, method=yivi, provider=verid)
  L-->>U: 302 naar VerID url + sessiecookie (SameSite=Lax)

  U->>V: Hosted VerID flow
  V->>Y: QR / deeplink: nin (BSN) delen
  Y-->>V: Disclosure
  V-->>U: 302 naar VERID_REDIRECT_URL (/auth?code&state)

  U->>A: GET /auth?code=…&state=…
  A->>S: session.init(): state en provider lezen
  Note over A: provider = verid: userFromVerIdLogin(state)<br/>(anders het bestaande OIDC-pad)
  A->>A: VerIdAuthenticator.finish(): callback state == sessie state?
  A->>C: finishSession({ callbackUrl })
  C->>VC: get(state): code_verifier
  C->>V: Token request (code + code_verifier + client secret)
  V-->>C: Token (openid)
  C->>VC: save(state → ontvangen token + hash van code)
  C->>V: Keys ophalen, token verifiëren
  C->>VC: remove(state)
  C-->>A: { format: "openid", payload.nin }
  A->>A: nin.identifier_type == NL_BSN: Bsn → Person
  A->>S: createSession(loggedin=true, identifier, bsn, user_type, username, xsrf_token [, email, telefoon])
  A-->>U: 302 naar / + sessiecookie
```

## Waar de flow kan stoppen

| Stap | Situatie | Resultaat |
|------|----------|-----------|
| Opstart | Flag uit of VerID-client niet op te zetten | Geen authenticator: Yivi via Signicat (of verborgen) |
| /login | `method=yivi` terwijl Yivi uit staat | 302 naar `/login` |
| /login | `createSession` faalt (intent geweigerd, VerID onbereikbaar) | 503-foutpagina, niets gecached |
| /auth | `?error=` in de callback (geannuleerd) | 302 naar `/login` |
| /auth | Geen sessiecookie / sessie niet gevonden | 302 naar `/login` |
| /auth | Callback state ≠ sessie state | 302 naar `/login` |
| /auth | Geen verifier voor de state (na 10 min verlopen of al gebruikt) | 302 naar `/login` |
| /auth | Token niet in openid-formaat of nin is geen `NL_BSN` | 302 naar `/login` |
| /auth | Opslaan van de ingelogde sessie faalt | 500 |

## Code

- `src/shared/VerIdFromEnv.ts`: bouwt de client uit de environment, met de DynamoDB-cache voor de verifier
- `src/shared/VerIdAuthenticator.ts`: `start()` en `finish()`, state-check en BSN uit het token
- `src/app/login/loginRequestHandler.ts`: `setupVerIdRedirect()`
- `src/app/auth/authRequestHandler.ts`: keuze op `provider` en `userFromVerIdLogin()`
- `@ver-id/core`: `openSession()` / `finishWithCode()`; de verifier komt uit `oauth4webapi`
