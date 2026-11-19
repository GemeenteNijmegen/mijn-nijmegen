# Phase 1: `useYiviSignicat` flag. Implementation Plan

> **Revision (2026-11-19):** the first version of this plan made the flag changeable at runtime (SSM read by the Lambda, cache, timeout, IAM grant). That was dropped as too complex. The flag now works like the existing `useYiviKvk` flag: an SSM parameter resolved at deploy time into a Lambda env var, so changing it needs a redeploy. History: commits `ebf1b34`..`cb5792c` contain the runtime version.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operators hide the Signicat Yivi login option by changing an SSM parameter and redeploying, the same way `useYiviKvk` works.

**Architecture:** CDK creates the SSM parameter `/cdk/mijn-nijmegen/useYiviSignicat` (default `'true'`). `ApiStack` resolves it with `StringParameter.valueForStringParameter` into the login Lambda env var `USE_YIVI_SIGNICAT`. `login.lambda.ts` passes `useYiviSignicatEnabled: process.env.USE_YIVI_SIGNICAT !== 'false'` to `LoginRequestHandler`, which hides Yivi when it is `false`.

**Tech Stack:** TypeScript, AWS CDK, jest.

**Spec:** this file, section "Full design (phase 2 context)" below.

## Global Constraints
- Parameter name: `/cdk/mijn-nijmegen/useYiviSignicat`, String, default `'true'` (`Statics.ssmFlaguseYiviSignicat`). Resolved at deploy time; changing it needs a redeploy (same as `useYiviKvk`).
- Env var `USE_YIVI_SIGNICAT`; only the exact string `'false'` disables Yivi (missing or any other value keeps it enabled).
- No runtime SSM access, no new dependencies, no IAM changes.
- Only the login Lambda reads the flag. The auth Lambda is unchanged, so in-flight Yivi logins still complete (my call).
- Existing Signicat Yivi/DigiD/eHerkenning tests stay green. No new required `Configuration` fields.

## Review Focus
- Flag off and `/login?method=yivi` requested (stale tab or bookmark): redirect to `/login`, not a 500 (ruling, see ledger in git history).
- Flag off and `useYiviKvk` on: Yivi stays hidden.
- Env var missing (e.g. preview/tests): Yivi stays visible.

### Task 1: Login handler honours the flag
**Files:** `src/app/login/loginRequestHandler.ts`, `src/app/login/login.lambda.ts`, test `src/app/login/tests/login.test.ts`.
**Interfaces:** new optional prop `useYiviSignicatEnabled?: boolean` on `LoginRequestHandlerProps` (undefined means enabled).
- [x] Tests: hides the yivi button when `useYiviSignicatEnabled` is false; redirects `method=yivi` to `/login` when false; shows yivi when true or undefined; hides yivi when disabled even with `useYiviKvk`.
- [x] `addAuthMethods` requires `useYiviSignicatEnabled !== false`; `setupAuthenticationRedirect` redirects a disabled `yivi` to `/login` before creating a session; `login.lambda.ts` maps `USE_YIVI_SIGNICAT`.

### Task 2: Infrastructure (parameter and env var)
**Files:** `src/statics.ts` (`ssmFlaguseYiviSignicat`), `src/ParameterStage.ts` (parameter `ssm_flag_yivi_signicat`, value `'true'`), `src/ApiStack.ts` (`USE_YIVI_SIGNICAT` env on `loginFunction()`), test `test/main.test.ts`.
- [x] Tests: `StackHasParameters` counts 29 and contains the parameter with value `true`; the ApiStack has an `AWS::SSM::Parameter::Value<String>` template parameter defaulting to the flag name, the login Lambda has `USE_YIVI_SIGNICAT`, and the login Lambda's policy has no `ssm:GetParameter`.
- [x] Implement the three file changes.

### How to change the flag
Set the parameter (console or `aws ssm put-parameter --name /cdk/mijn-nijmegen/useYiviSignicat --type String --value false --overwrite`), then redeploy (re-run the pipeline) so the Lambda env var picks it up. A manual value survives normal deploys as long as the parameter resource's properties in CDK do not change.

### Verification
`npx projen bundle`, then `npx jest` and `npx projen eslint`. Note: the pipeline `Snapshot` test in `test/main.test.ts` contains asset hashes that depend on the local build output and also fails on the untouched base commit in this sandbox; regenerate it in CI (self mutation) rather than from the sandbox.

---

# Full design (phase 2 context): VerID Yivi login next to Signicat, behind SSM flags

## Phasing (user decision)
- **Phase 1 (done): only the `useYiviSignicat` flag**, deploy-time SSM like `useYiviKvk`. See the plan above.
- **Phase 2 (implemented, see "Phase 2 as built" below):** the `useYiviVerId` flag and the full VerID flow described in the design.

## Context
Mijn Nijmegen authenticates via Signicat only (Yivi, DigiD, eHerkenning chosen by OIDC scope). VerID is the new multi-wallet platform and is expected to replace Yivi-via-Signicat. We add a VerID login path (OAuth code + PKCE via `@ver-id/node-client`) and two flags so the rollout can be switched per environment through SSM.

## Goals
- Users can log in with a wallet via VerID and end up with the same session as today (Person from BSN).
- Flag `useYiviSignicat`: turns the existing Signicat Yivi button/path off.
- Flag `useYiviVerId`: turns the VerID button/path on.
- Flags are SSM parameters resolved at deploy time (same mechanism as `useYiviKvk`); changing one needs a redeploy.

## Non-goals
- No change to DigiD / eHerkenning (stay on Signicat; assumption, confirmed implicitly by the request only mentioning Yivi).
- No organisation (KvK / `company` scope) login via VerID in this version. Persons only (user decision).
- No provider-interface refactor (user chose approach A).
- No IdP logout: VerID docs list no end-session endpoint; logout stays local.

## Approaches considered
- **A (chosen):** add VerID beside Signicat in the same `/login` and `/auth` routes, dispatch on the session `method`. Small diff, easy to delete the Signicat Yivi branch later.
- B: refactor to an `AuthProvider` interface first. Cleaner long term, but rewrites working DigiD/eHerkenning code for one provider.
- C: separate `/login/verid`, `/auth/verid` routes and Lambdas. Isolated, but duplicates session/BRP/OpenKlant handling and routing.
- Flags: deploy-time SSM parameter into a Lambda env var (chosen, same as `useYiviKvk`). A runtime SSM read was built first and removed as too complex (cache, timeout, IAM); `Configuration.ts` booleans were rejected because they need a PR to change.

## Design
**Flags** (SSM String params, created in `src/ParameterStage.ts`, names in `src/statics.ts`):
- `/cdk/mijn-nijmegen/useYiviSignicat` default `'true'` (phase 1, done), `/cdk/mijn-nijmegen/useYiviVerId` default `'false'`. (Defaults are my call: nothing changes until VerID is switched on.)
- Both flags follow the `useYiviKvk` pattern: `Statics` name, `ParameterStage` parameter, `StringParameter.valueForStringParameter` into Lambda env vars in `ApiStack`. Both the login and auth Lambdas get the VerID flag so page and callback agree.

**Login** (`src/app/login/loginRequestHandler.ts`):
- `addAuthMethods`: show `yivi` only if `yiviScope` set AND `useYiviSignicat` on; show new `verid` if `useYiviVerId` on.
- `setupAuthenticationRedirect`: new `verid` case: `createSession({scope: 'openid nin'})` (scope exact names to verify in Studio; `profile` optional), store returned `state` and `method: 'verid'` in the session, 302 to the VerID url. Reject a method whose flag is off.
- Template: new `verid` button + `static/images/verid.svg`; label is wallet-neutral (my call, e.g. "Inloggen met identiteitsapp"), since the user picks the wallet on VerID's screen. Update intro/footer text mentioning Yivi; update `src/preview/fixtures/login.ts`.

**Callback** (`src/app/auth/AuthRequestHandler.ts`, `auth.lambda.ts`):
- Read `method` from the session. For `verid`: compare callback `state` to the stored one, call `finishSession({callbackUrl})`, take `payload.nin.identifier` (require `identifier_type === 'NL_BSN'`), build `Person(bsn, {haalCentraal})`, then the existing session creation, BRP name lookup and OpenKlant steps. Add `'verid'` to `AuthenticationMethod`.
- New `src/shared/VerIdAuthenticator.ts` wrapping `VeridAuthenticationClient` (issuerUri, flow id as clientId, secret, redirectUri, cacheManager). Pin an exact SDK version (pre-1.0).
- Existing Signicat branches untouched.

**Verifier store:** custom `ICacheManager` (`save/get/remove`) on DynamoDB with TTL (~10 min), or the SDK's `DynamoDBCacheManager`. Call: new small on-demand table with `pk` + `ttl` (matches the SDK's built-in manager, so we use that) rather than overloading the sessions table. Grant read/write to login and auth Lambdas.

**Config/secrets** (`ParameterStage.ts`, `statics.ts`, `ApiStack.ts`): new params for VerID issuer URI, flow/client id, redirect URL (the `/auth` URL registered on the flow), and a client secret (Secrets Manager, same pattern as Signicat, ~$0.40/month). Env vars on login and auth functions, `grantRead` on the secret.

**Left to the builder / to verify before go-live:** exact scope names and `nin` payload shape against a real flow (docs say `nin.identifier`, `NL_BSN`; `testNin` for demo), issuer URI per environment, redirect URI registration, behaviour when the wallet returns no verified BSN (treat as login failure -> `/login`).

## Tests
- Unit: login handler shows/hides buttons for each flag combination and rejects a disabled method; auth handler `verid` path (mock `VerIdAuthenticator` like the existing mocked OIDC client): BSN success, wrong `identifier_type`, missing `nin`, state mismatch, replayed callback.
- `test/main.test.ts` CDK assertions for the new params, table, IAM grants; keep new `Configuration` fields optional.
- Existing Signicat Yivi/DigiD tests must stay green.

## Verification
`npx jest` for the touched suites and `test/main.test.ts`, then the project build/lint. End-to-end in development: set `useYiviVerId=true` and `useYiviSignicat=false` in SSM and redeploy, check the login page, complete a login with a VerID test flow, confirm the session/home page, redeploy, then flip back and redeploy to confirm the buttons change.

## Phase 2 as built

VerID is the other provider behind the **one existing Yivi button** (same `yivi` method, same icon). Which provider handles it is decided by the flags:
- `useYiviVerId` on: the Yivi button logs in via VerID (takes precedence).
- else `useYiviSignicat` on (default): Yivi via Signicat as before.
- both off: no Yivi button.

Code:
- `src/shared/VerIdAuthenticator.ts`: `start()` (scope `openid nin`) and `finish(callbackUrl, expectedState)`; checks the callback `state` against the session state, format `openid`, `nin.identifier_type === 'NL_BSN'` and a valid `Bsn`.
- `src/shared/VerIdFromEnv.ts`: builds the real client with the SDK's `DynamoDBCacheManager` (PKCE verifiers, TTL 600s) from the lambda environment. Returns nothing when `USE_YIVI_VERID` is not `true` or VerID cannot be set up, so a broken VerID setup never affects DigiD, eHerkenning or Yivi via Signicat. No separate flag props: "authenticator present" means "VerID on".
- Login: `LoginRequestHandler` gets an optional `verIdAuthenticator`; for `method=yivi` it uses VerID's url and state instead of Signicat's, otherwise unchanged. The session keeps method `yivi`.
- Callback: `AuthRequestHandler` finishes a `yivi` session with VerID when an authenticator is configured, otherwise via Signicat as before. Any VerID failure redirects to `/login` without a session. (Shortcut: dispatch is on the flag, not on a stored provider, so a Yivi login in flight during a redeploy that flips the flag fails and the user logs in again.)
- Infra: parameters `/cdk/mijn-nijmegen/useYiviVerId` (default `false`), `/cdk/mijn-nijmegen/verid/{issuer-uri,client-id,redirect-url}` (placeholder `-`), secret `/cdk/mijn-nijmegen/verid/clientsecret`, DynamoDB table (pk, TTL `ttl`, on-demand) in `ApiStack`, env vars and grants on the login and auth Lambdas.
- Dependencies: `@ver-id/node-client` pinned at `0.16.0`, `@aws-sdk/lib-dynamodb`.
- Jest cannot load the SDK's ES-module dependency (`jose`), same as `openid-client`, so the SDK is mocked in `VerIdFromEnv.test.ts`; the real SDK was verified by bundling with esbuild and constructing the client in node.

### Before switching `useYiviVerId` on (per environment)
1. In VerID Studio: create the authentication flow, enable the wallets and the `nin` scope on it, register our `/auth` URL as redirect URI, create an OAUTH secret and attach it.
2. Fill the parameters `verid/issuer-uri`, `verid/client-id` (the flow id, must be a UUID), `verid/redirect-url` and the secret `verid/clientsecret`.
3. Set `useYiviVerId` to `true` (optionally `useYiviSignicat` to `false`) and redeploy.
4. Verify with a real login: the BSN arrives as `nin.identifier` of type `NL_BSN` (use the `testNin` scope on a test flow first).

### Not done
- Organisations (`company` scope) are out of scope for this version.
