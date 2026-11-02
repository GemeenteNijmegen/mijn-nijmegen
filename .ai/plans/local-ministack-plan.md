# Plan: run Mijn Nijmegen locally on MiniStack

## TL;DR

- **Goal.** Run the whole app on a laptop with one command. Every page lambda is
  deployed by a real `cdk deploy` into [MiniStack](https://github.com/ministackorg/ministack).
  Login works through a local Keycloak that pretends to be DigiD and eHerkenning.
  All backends are mocked.
- **Prior art.** zaakaggregator already does this for the mijn-services-aggregator
  (`zaakaggregator/src/app/mijn-services/test/local/`): MiniStack + WireMock, a
  separate CDK app, and one `scripts/local.sh` entrypoint. We copy that layout
  and its known workarounds (Docker Lambda executor for `nodejs24.x`, pinned
  function names for logs, `ms-custom-id` for a stable API id, a log-polling
  script instead of `aws logs tail`).
- **Where.** Everything lives in `test/local/`, outside projen's generated files
  and outside the production CDK app (`src/main.ts`). Nothing in the pipeline
  changes.
- **Pieces in `docker-compose.yml`:**
  `ministack` (AWS emulator), `keycloak` (DigiD/eHerkenning mock),
  `backend-mock` (WireMock for all backends, including Haal Centraal) and
  `proxy` (Caddy, takes CloudFront's role on `http://localhost:3000`).
- **Delivery.** 6 small PRs. Each one is useful on its own. PR 1 starts with a
  spike on the two biggest unknowns: HTTP API (v2) support in MiniStack, and
  Keycloak issuer/hostname handling.

## Why a separate local stack (and not the real `ApiStack`)

The real `ApiStack` can't be deployed into MiniStack as it is:

| Problem in `ApiStack` / `ApiFunction` | Why it breaks locally | Local stack does |
|---|---|---|
| `Secret.fromSecretNameV2` / `StringParameter.valueForStringParameter` for ~40 values (`Statics.*`) | They must already exist before deploy. `valueForStringParameter` turns into a CloudFormation SSM parameter type. | Creates every secret and parameter in the stack with a local dummy value |
| `ApiFunction` adds the Lambda Insights layer (account `580247275435`) | The layer doesn't exist in MiniStack | Uses the projen `*Function` classes directly, no layer |
| `ApiFunction` sets `logRetention` | Adds a custom-resource Lambda just to set retention | Not set |
| `ApiFunction` adds a `MetricFilter` + `Alarm` per function | Not needed locally, more emulator surface | Not added |
| `SessionsTable` uses a customer-managed KMS key and `RETAIN` | KMS stack + key policy aren't needed locally; `RETAIN` leaves the table behind on redeploy | Plain table, `DESTROY` |
| `ApiStack` reads `PipelineStack` / `Configuration` per branch | Pulls in the whole pipeline | Fixed local config |
| Pages are served through CloudFront (`/static/*` from S3, rest from API Gateway) | No CloudFront in MiniStack | Caddy proxy (see below) |

The cost is that routes and env vars are defined twice. To stop the two from
drifting apart we add a test (PR 6) that synthesizes both stacks and checks
that they have the same route keys, and that each local function gets the same
env var *names* as its real counterpart.

## Target layout

```
test/local/
├── README.md                 how to run it, known MiniStack gaps
├── cdk.json                  "app": "npx ts-node cdk/app.ts"
├── docker-compose.yml
├── cdk/
│   ├── app.ts                env: 000000000000 / eu-central-1 (or us-east-1, see spike)
│   ├── LocalMijnNijmegenStack.ts
│   └── localConfig.ts        all dummy values, hostnames and feature flags in one place
├── keycloak/
│   └── realm-mijn-nijmegen.json   imported on start
├── wiremock/
│   ├── __files/              response bodies (JSON / SOAP XML)
│   └── mappings/             stub mappings (loaded on start, no seed step)
├── proxy/
│   └── Caddyfile
└── scripts/
    └── local.sh              up | down | deploy | logs <fn> | start | help
```

Tip from zaakaggregator: load WireMock stubs from `mappings/` via a volume, not
via a seed script. That removes a whole step. zaakaggregator used a seed script
because it needed Host-header matching per alias; we don't.

## The local CDK stack

`LocalMijnNijmegenStack` contains:

1. **Sessions table.** `mijn-nijmegen-sessions`, partition key `sessionid`,
   TTL `ttl`, pay per request, `RemovalPolicy.DESTROY`. No KMS key.
2. **Secrets and parameters.** For each `Statics.*` name the lambdas use, a
   `Secret` (with `SecretValue.unsafePlainText`) or a `StringParameter`
   with the **same name** as in production. The handlers then resolve them
   through MiniStack exactly as they would in AWS (`AWS.getSecret`,
   `AWS.getParameter` from `@gemeentenijmegen/utils`). Values come from
   `localConfig.ts`.
3. **Nine lambdas**, using the projen classes (`LoginFunction`,
   `AuthFunction`, `LogoutFunction`, `HomeFunction`,
   `PersoonsgegevensFunction`, `UitkeringFunction`, `ZakenFunction`,
   `TakenFunction`, `ProductenFunction`). Each one gets:
   - `functionName: 'local-<name>'`, so the log group is predictable;
   - the env vars from the table below;
   - `grantRead` on its secrets/parameters and `grantReadWriteData` on the
     table. MiniStack probably doesn't enforce IAM, but this keeps the stack
     close to the real one.
4. **One HTTP API (v2)** with all routes from `ApiStack.setFunctions`,
   including the routes behind `mijnContactGegevensLive` and
   `mijnProductenLive` (both on by default locally, switchable in
   `localConfig.ts`). Tag `ms-custom-id: mijn-nijmegen` for a stable id.

   It **must** be an HTTP API, not a REST API like zaakaggregator. The handlers
   read `event.cookies`, `event.rawPath` and `event.rawQueryString`, which only
   exist in the v2 payload. If MiniStack can't do HTTP APIs (spike, PR 1), the
   fallback is a REST API with `payloadFormatVersion` 2.0 if supported. If not,
   a small adapter would have to wrap each handler locally. We would rather not
   do that.

### Env vars per lambda

Every lambda also gets `APPLICATION_URL_BASE=http://localhost:3000/`,
`SESSION_TABLE`, `OIDC_SCOPE` and `NODE_OPTIONS=--enable-source-maps`. All
secret/parameter values point to the resources from step 2.

| Lambda | Extra env vars | Talks to |
|---|---|---|
| login | `OIDC_*`, `DIGID_SCOPE`, `EHERKENNING_SCOPE`, `YIVI_*`, `USE_YIVI_KVK=false`, `USE_GEMACHTIGD=false` | Keycloak (discovery) |
| auth | as login + `HAAL_CENTRAAL_*`, `OPENKLANT_*`, `CONTACTGEGEVENS_LIVE` | Keycloak (token), brp-mock, backend-mock (OpenKlant) |
| logout | — | — |
| home | `CONTACTGEGEVENS_LIVE`, `SHOW_PRODUCTEN`, `ZAKEN_APIGATEWAY_*` | backend-mock (zaakaggregator) |
| persoonsgegevens | `HAAL_CENTRAAL_*`, `OPENKLANT_*`, `NOTIFY_*`, `CONTACTGEGEVENS_LIVE` | brp-mock, backend-mock (OpenKlant, NotifyNL) |
| uitkeringen | `MTLS_*`, `UITKERING_API_URL` | backend-mock (SOAP) |
| zaken | `VIP_*`, `SUBMISSIONSTORAGE_*`, `SUBMISSIONS_LIVE=false`, `ZAKEN_APIGATEWAY_*` | backend-mock (zaakaggregator) |
| taken | `ZAKEN_APIGATEWAY_*` | backend-mock (zaakaggregator) |
| producten | `SHOW_PRODUCTEN`, `ARC_*`, `MSA_CREDENTIALS`, `ZAKEN_APIGATEWAY_*` | backend-mock (ARC, mijn-services-aggregator) |

### mTLS secrets

`HaalCentraalApi` and `UitkeringFunction` load a client certificate, key and
(for uitkeringen) a root CA, and build an HTTPS agent with them. Locally the
URLs are `http://`, so axios ignores the agent. We still store a valid
**self-signed** dummy cert/key (committed, clearly marked as test-only) so that
any parsing during init doesn't fail. Check in PR 3 whether
`@gemeentenijmegen/apiclient` (uitkeringen) refuses an `http://` URL; if it
does, give WireMock an HTTPS port with a self-signed cert and put the CA in
`MTLS_ROOT_CA`.

## docker-compose

One network, `mijn-nijmegen-local`. MiniStack starts the Lambda containers on it
(`DOCKER_NETWORK`), so lambdas reach the other services by service name.

| Service | Image | Host port | Role |
|---|---|---|---|
| `ministack` | `ministackorg/ministack:<pinned>` | 4566 | Lambda, API Gateway v2, DynamoDB, Secrets Manager, SSM, CloudFormation, Logs. `LAMBDA_EXECUTOR=docker` (we use `nodejs24.x`), `/var/run/docker.sock` mounted |
| `keycloak` | `quay.io/keycloak/keycloak:<pinned 26.x>` | 8081 | DigiD/eHerkenning OIDC mock. `start-dev --import-realm` |
| `backend-mock` | `wiremock/wiremock:3.9.2` | 8080 | Haal Centraal BRP, zaakaggregator/MSA, uitkeringen (SOAP), ARC, OpenKlant, NotifyNL |

**Decided in PR 2:** no `brp-mock`. The official `personen-mock` image doesn't
return `adressering` (the real BRP API derives it), and the app reads the
user's name from `adressering.aanschrijfwijze.naam`. WireMock serves the
production-shaped fixtures from `src/app/persoonsgegevens/tests/users.ts`
instead, matched on BSN.
| `proxy` | `caddy:2-alpine` | **3000** | The app's address in the browser |

Pin the `ministack` image to a version (zaakaggregator uses `latest`, which is
a reproducibility risk).

### Why a proxy is needed

MiniStack serves the API at `http://localhost:4566/_aws/execute-api/<id>/...`.
The app redirects to root-relative paths (`Response.redirect('/login')`,
`'/'`) and the templates link to `/static/...` and `/zaken/...`. Under a path
prefix all of that breaks. Caddy takes CloudFront's role:

```
localhost:3000/static/*   -> file_server on src/app/static-resources/static (bind mount)
localhost:3000/           -> rewrite to /home (CloudFront defaultRootObject)
localhost:3000/*          -> reverse_proxy ministack:4566, path prefixed with /_aws/execute-api/mijn-nijmegen
```

Session cookies are `Secure`. Browsers accept `Secure` cookies on
`http://localhost`, so this works without TLS. Confirm in Chrome and Firefox.

## Keycloak as DigiD / eHerkenning

The app decides the login method from the **scopes returned** in the token
response (`AuthRequestHandler.authMethodFromScope`) and then reads:

- DigiD: BSN in `sub`;
- eHerkenning: `urn:etoegang:1.9:EntityConcernedID:KvKnr` and
  `urn:etoegang:1.11:attribute-represented:CompanyName`;
- optional `acr` / `amr` for logging only.

Realm `mijn-nijmegen` (committed as JSON export):

- **Client** `mijn-nijmegen`: confidential, standard flow, redirect URI
  `http://localhost:3000/auth`, post-logout `http://localhost:3000/*`. The
  secret is fixed in the export and the same value goes into the local
  `OIDC_CLIENT_SECRET` secret.
- **Client scopes** `digid`, `eherkenning` (and `yivi` later) as *optional*
  scopes on the client. The scope names match `DIGID_SCOPE` /
  `EHERKENNING_SCOPE` in `localConfig.ts`, so Keycloak echoes them back in
  `scope`. Mappers sit on the scope, so the claims only appear when that login
  method is used:
  - `digid`: BSN in `sub`. **Decided in PR 2:** DigiD users are imported with
    their BSN as Keycloak user id, so the standard `sub` is the BSN. That
    avoids depending on mapper order to override `sub`.
  - `eherkenning`: user attributes `kvk` and `companyName` -> the two `urn:`
    claims above. Disable "dotted claim name -> nested object" handling where
    needed; the names contain `:` and `.`.
- **Users** (password = username):
  - `digid-<bsn>` for 2–3 BSNs that exist in personen-mock (one plain,
    one with partner/children, one without uitkering), so persoonsgegevens
    shows real data;
  - `eherkenning-<kvk>` for one company.
- Optional: a login theme with "DigiD (mock)" / "eHerkenning (mock)" labels, so
  nobody thinks they're on the real thing. Low priority.

### Issuer / hostname (spike in PR 1)

The browser goes to Keycloak at `localhost:8081`. The auth lambda calls
discovery and the token endpoint from inside the Docker network at
`keycloak:8080`. The `iss` claim must equal the discovered issuer, otherwise
`openid-client` rejects the token. Options, in order of preference:

1. Keycloak 26 hostname v2: `KC_HOSTNAME=http://localhost:8081` plus
   `KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true`. Frontend URLs and the issuer use
   `localhost:8081`; backchannel endpoints (token, jwks) follow the request
   host `keycloak:8080`. `OIDC_WELL_KNOWN` then points at
   `http://keycloak:8080/realms/mijn-nijmegen/.well-known/openid-configuration`.
2. A fixed hostname such as `keycloak.mijn-nijmegen.local` as a network alias
   plus an `/etc/hosts` entry on the laptop (what open-forms does). Works
   always, but requires a manual step.

Fallback to 2 if 1 doesn't give a consistent issuer.

## WireMock stubs (`backend-mock`)

Path prefix per backend, so one container is enough:

| Prefix | Stands in for | Needed by | Minimum stubs |
|---|---|---|---|
| `/zaakaggregator` | zaakaggregator API Gateway (`ZAKEN_APIGATEWAY_BASEURL`) | home, zaken, taken, producten | zaken list, one zaak detail, taken list, one document download |
| `/msa` | mijn-services-aggregator (producten) | producten | producten list, one product |
| `/arc` | ARC | producten | redirect URL response |
| `/uitkeringen` | Uitkeringen SOAP service | uitkeringen | one SOAP response with 1 uitkering, one empty response (match on BSN in body) |
| `/openklant` | OpenKlant | auth, persoonsgegevens | partij/digitale adressen list, POST/PATCH accept |
| `/notify` | NotifyNL | persoonsgegevens | send email/SMS -> 201 |

Fixtures are copied from existing tests where they exist
(`src/app/*/tests/`, e.g. the uitkeringen and zaken responses) so we don't
invent new data. Use WireMock request matching on BSN where pages should show
different data per test user.

Later (not in this plan): point `ZAKEN_APIGATEWAY_BASEURL` at the real
zaakaggregator local stack instead of WireMock. Both use MiniStack on 4566, so
that needs one shared MiniStack or a port change. Out of scope for now.

## `scripts/local.sh`

Same shape as zaakaggregator's:

- `up` — `docker compose up -d`, wait for MiniStack + Keycloak health;
- `down` — `docker compose down -v`;
- `deploy` — `npx projen bundle` (all lambdas + CSS bundle + web components),
  `cdk bootstrap aws://000000000000/<region>`, `cdk deploy --require-approval never`;
- `logs <function>` — poll `FilterLogEvents` on `/aws/lambda/local-<function>`
  (copy the workaround for the missing `eventId`);
- `start` — `down`, `up`, `deploy`, then print the URL and the test users;
- `help`.

Env: `AWS_ENDPOINT_URL=http://localhost:4566`, dummy credentials.

## Delivery

Each PR goes to `development` and leaves production untouched.

1. **Spike + skeleton.** `test/local/` with compose (`ministack`, `proxy`),
   `cdk/app.ts`, a stack with only the sessions table + `logout` lambda +
   HTTP API, and `local.sh up/down/deploy/logs`.
   Answers: does MiniStack support HTTP API v2 with the v2 payload and
   `cookies`? Does the proxy path rewrite work with redirects? Which region?
   Done when `http://localhost:3000/logout` renders the logout page with CSS.
2. **Login with Keycloak.** Add `keycloak` + realm export, `login` and `auth`
   lambdas, OIDC secrets/parameters, `home` lambda. Resolve the
   issuer/hostname question and the `sub` = BSN mapper.
   Done when a DigiD test user logs in and lands on `/home`, and logout works.
   Outcome:
   - WireMock is introduced here already: `auth` calls Haal Centraal on login,
     and `home` always calls the zaakaggregator (empty lists for now).
   - eHerkenning login is included (scope, claim mappers, one user), as the
     auth lambda needs a non-empty eHerkenning scope anyway.
   - openid-client v6 refuses plain http. `OpenIDConnect` got an opt-in
     `allowInsecureRequests`, set through `OIDC_ALLOW_INSECURE_REQUESTS` only by
     the local stack.
   - The auth lambda sends `OIDC_REDIRECT_URL + rawPath` as `redirect_uri` in
     the token request, while login sends `OIDC_REDIRECT_URL`. Keycloak needs
     them to be equal, so locally auth gets the URL without `/auth`. In
     production both come from the same SSM parameter; worth checking whether
     the real IdP is just lenient here.
3. **Persoonsgegevens + uitkeringen.** Uitkeringen SOAP stubs, the mTLS dummy
   secrets, and both lambdas.
   Done when both pages show data for every DigiD test user.
4. **Zaken, taken, producten.** WireMock stubs for zaakaggregator, MSA and ARC;
   the three lambdas; `useZakenFromAggregatorAPI`-style env on home.
   Done when lists, a zaak detail, a document download and a product open.
5. **Contactgegevens.** OpenKlant + NotifyNL stubs; edit/verify routes
   (eHerkenning moved to PR 2).
   Done when a DigiD user can edit and verify contact details.
6. **Hardening.** Drift test (route keys + env var names, local vs
   `ApiStack`, as a normal Jest test under `test/`); README with known
   MiniStack gaps; optional: run Playwright (`test/playwright`) against
   `localhost:3000`; optional: GitHub workflow that runs `local.sh start` and a
   smoke test.

## Open questions

- **HTTP API v2 in MiniStack.** Biggest risk. If it's missing, we need a
  decision between a REST API with an adapter or contributing support upstream.
- **Region.** Production uses `eu-central-1`. zaakaggregator local uses
  `us-east-1` because MiniStack's docs do. Use `eu-central-1` unless the spike
  shows problems.
- **Yivi.** Not in scope. Keycloak can mock it later with a `yivi` scope and
  the `YIVI_BSN_ATTRIBUTE` / KvK attributes, in the same way as DigiD.
- **Gemachtigd / DigiD machtigen.** `USE_GEMACHTIGD=false` locally. Add later
  if needed.
- **Where to keep shared route definitions.** Option: extract the route list
  from `ApiStack.setFunctions` into a function that both stacks call. That
  removes duplication instead of only detecting it, but touches production
  code. Decide after PR 6 shows how much drift we really get.
