# Run Mijn Nijmegen locally on MiniStack

A local setup that deploys the page lambdas with a real `cdk deploy` into
[MiniStack](https://github.com/ministackorg/ministack), a free, open-source
local AWS emulator. Login goes through Keycloak, which stands in for DigiD and
eHerkenning. No AWS account is needed.

Deployed so far: **login, auth, home, logout, persoonsgegevens, uitkeringen,
zaken and taken**. Producten and editing contactgegevens follow in later steps.

Everything lives in `test/local/`. It is not part of the production CDK app
(`src/main.ts`) or the pipeline, and `npx projen` doesn't touch it.

## Pieces

| Service | Port | Role |
|---|---|---|
| `ministack` | 4566 | CloudFormation, DynamoDB, Lambda, API Gateway v2, Secrets Manager and SSM. Lambdas run in real `nodejs24.x` containers (Docker executor), so MiniStack needs `/var/run/docker.sock`. |
| `keycloak` | 8081 | DigiD/eHerkenning mock. Realm imported from `keycloak/realm-mijn-nijmegen.json`. Admin console: <http://localhost:8081/admin> (`admin`/`admin`). |
| `backend-mock` | 8080 | WireMock for every backend the lambdas call. Stubs in `wiremock/mappings/`, bodies in `wiremock/__files/`. |
| `proxy` | 3000 | Caddy, takes CloudFront's role. Serves `/static/*` from `src/app/static-resources/static`, sends `/` to `/home` and forwards everything else to the HTTP API in MiniStack. |

`cdk/LocalMijnNijmegenStack.ts` is a real CDK stack: the sessions table, the
page lambdas, the secrets and parameters they read, and an HTTP API with their
routes. All local values (URLs, scopes, client id/secret) are in
`cdk/localConfig.ts`.

## Prerequisites

- Docker + Docker Compose
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html),
  only for `local.sh logs`
- Repo dependencies installed (`npm ci` at the repo root)
- Ports 3000, 4566, 8080 and 8081 free. The zaakaggregator local setup also
  uses 4566 and 8080, so don't run both at the same time.

## Run it

```bash
test/local/scripts/local.sh start
```

`start` runs `down`, `up` (all containers) and `deploy` (bundle the lambdas and
static resources, `cdk bootstrap`, `cdk deploy`). Each step is also its own
command; run `test/local/scripts/local.sh help` for the list.

Then open <http://localhost:3000/login> and log in. The password is the same
as the username:

| Method | Username | Who |
|---|---|---|
| DigiD | `digid-999999333` | N. Boeddhoe |
| DigiD | `digid-999998754` | H. van Hapert |
| eHerkenning | `eherkenning-69599084` | Mock Bedrijf B.V. (KvK 69599084) |

After login you land on the home page with your name in the header.
Both DigiD users see their own data on Mijn gegevens. `digid-999999333` also
has zaken, taken and two uitkeringen; the other users have none.

Changed lambda code? Run `test/local/scripts/local.sh deploy` again. Changed a
file in `static/`? Reload the page. Changed a WireMock stub? Restart the mock:
`docker compose -f test/local/docker-compose.yml restart backend-mock`. Changed
the realm? Run `start` again; Keycloak only imports a realm that doesn't exist
yet.

Use Chrome or Firefox. The session cookie is `Secure`; those browsers accept
that on `http://localhost`, Safari may not.

## How the mocks work

### Keycloak as DigiD and eHerkenning

The app decides the login method from the scopes in the token response, so the
realm has a client scope per method. Keycloak puts the requested scope back in
the token response.

- **`digid`**: the BSN is the `sub` claim. Keycloak always uses the user id as
  `sub`, so the DigiD test users are imported with their BSN as id.
- **`eherkenning`**: maps the user attributes `kvk` and `companyName` to the
  `urn:etoegang:1.9:EntityConcernedID:KvKnr` and
  `urn:etoegang:1.11:attribute-represented:CompanyName` claims.

Like DigiD and eHerkenning, Keycloak asks for a username and password on every
login. The realm's browser flow (`browser-without-sso`) leaves out Keycloak's
SSO cookie check, which would otherwise log you straight back in after `/logout`
(the app's logout only ends the app session, not the one at the IdP).

The browser talks to Keycloak on `localhost:8081`, the lambdas on
`keycloak:8080`. `KC_HOSTNAME` and `KC_HOSTNAME_BACKCHANNEL_DYNAMIC` in
`docker-compose.yml` make both work with the same issuer.

To add a DigiD user: add a user to the realm file with the BSN as `id`, and a
Haal Centraal fixture for that BSN (see below).

### Backends (WireMock)

| Backend | Hostname in the lambdas | Stubs |
|---|---|---|
| Haal Centraal BRP | `haalcentraal.backend-mock` | `mappings/haalcentraal.json`: one response per BSN from `__files/haalcentraal/<bsn>.json`, an empty result for other BSNs |
| zaakaggregator | `zaakaggregator.backend-mock` | `mappings/zaakaggregator.json`: for BSN 999999333 three zaken (open, closed, inzending), their details, two taken and the downloads. Empty lists for everyone else |
| Uitkeringen (SOAP) | `uitkeringen.backend-mock` | `mappings/uitkeringen.json`: two uitkeringen for BSN 999999333 (matched on `<identifier>` in the body), an empty response for other BSNs |

`mappings/documenten.json` serves a sample PDF and a placeholder taak form to
the browser on `localhost:8080`. The download stubs cover both ways the
zaakaggregator returns a file:

- a zaak document comes back as `application/octet-stream`, which the zaken
  lambda passes on base64-encoded (`isBase64Encoded`);
- an inzending document and a taak attachment come back as a `downloadUrl`,
  which the zaken lambda redirects to (in production a presigned S3 url, here
  WireMock on `localhost:8080`).

The uitkeringen fixtures are copies of `src/app/uitkeringen/tests/responses/`.
The Haal Centraal fixtures come from `src/app/persoonsgegevens/tests/users.ts`.
They include `adressering`, which the real BRP API derives and the official
`personen-mock` image doesn't, and which the app uses for the user's name.

## Logs

```bash
test/local/scripts/local.sh logs auth
```

This polls `/aws/lambda/local-auth` every 2 seconds. Use the name of any page:
`login`, `auth`, `home`, `logout`, `persoonsgegevens`, `uitkeringen`, `zaken`,
`taken`. The function names are pinned in
`LocalMijnNijmegenStack.ts` (`local-<name>`) so the log groups are predictable.
Plain `aws logs tail --follow` doesn't work against MiniStack: it expects an
`eventId` field that MiniStack doesn't return.

If something fails before your handler runs, check the containers themselves,
for example `docker compose -f test/local/docker-compose.yml logs -f ministack`.
WireMock logs every request it receives (`--verbose`).

## Differences from the real stacks

`LocalMijnNijmegenStack` copies the relevant parts of `SessionsStack` and
`ApiStack`, but leaves out:

- the customer-managed KMS key and `RETAIN` policy on the sessions table;
- `ApiFunction`'s Lambda Insights layer, log retention, metric filters and
  alarms. The projen-generated `*Function` classes are used directly;
- CloudFront, WAF, DNS and certificates (the proxy covers what's needed);
- the `Configuration` per branch, and the SSM parameters that `ApiStack`
  resolves at deploy time. Their values are set directly in `localConfig.ts`.

Local-only settings:

- `OIDC_ALLOW_INSECURE_REQUESTS=true` on login and auth, because Keycloak runs
  on plain http. openid-client refuses that unless told otherwise. Production
  never sets this variable.
- `OIDC_REDIRECT_URL` is `http://localhost:3000/auth` for login, but
  `http://localhost:3000` for auth. The auth lambda appends the request path
  to it, and the result must be the same `redirect_uri` that login sent.
- No `YIVI_SCOPE` on login (hides the Yivi button), and a placeholder on auth,
  where an empty value would be mistaken for a Yivi login.
- `CONTACTGEGEVENS_LIVE` is `False`, so Mijn gegevens shows no contactgegevens
  and the edit/verify routes don't exist yet. Turning it on needs OpenKlant and
  NotifyNL mocks.
- The mTLS key, certificate and root CA for uitkeringen (and Haal Centraal) are
  placeholders. The backends are plain http, so axios never uses the https
  agent they go into.
- The zaken lambda gets the `VIP_*` and `SUBMISSIONSTORAGE_*` variables
  `ApiStack` sets, with placeholder values. The handler doesn't read them.

It must stay an **HTTP API** (API Gateway v2): the handlers read
`event.cookies`, `event.rawPath` and `event.rawQueryString`, which only exist in
the v2 payload.
