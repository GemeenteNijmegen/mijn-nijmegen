# Phase 1: `yiviSignicat` runtime flag. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operators hide the Signicat Yivi login option by editing an SSM parameter, without a redeploy.

**Architecture:** A small `FeatureFlags` reader fetches an SSM String parameter at runtime (60s in-memory cache, fail-open to a default). `login.lambda.ts` resolves the flag per request and passes a plain boolean to `LoginRequestHandler`, which stays synchronous. CDK creates the parameter (default `'true'`) and grants the login Lambda `ssm:GetParameter`.

**Tech Stack:** TypeScript, AWS CDK, `@aws-sdk/client-ssm` (already a dependency), jest + `aws-sdk-client-mock`.

**Spec:** this file, section "Full design (phase 2 context)" and "Phasing" below.

## Global Constraints
- Parameter name: `/cdk/mijn-nijmegen/flags/yiviSignicat`, String, CDK default `'true'`. The default in the template must never change, so deploys don't overwrite a manually set value.
- Cache TTL 60 seconds. Flag value is `true` only if the trimmed, lower-cased value equals `'true'`; any other stored value means `false`.
- Any SSM failure (including parameter not found) returns the supplied default (`true` for this flag): login keeps working.
- Only the login Lambda reads the flag. The auth Lambda is unchanged, so in-flight Yivi logins complete when the flag is flipped (my call).
- Existing Signicat Yivi/DigiD/eHerkenning tests stay green. No new required `Configuration` fields.

## Review Focus
- Stored value `'True'`, `' false '` (repo mixes casing): normalised as in Global Constraints.
- SSM throws / parameter missing: login page still renders with Yivi shown (fail open).
- Flag flipped while a user is between `/login` and `/auth`: callback still succeeds.
- Flag off and `/login?method=yivi` requested (stale bookmark): treated as unsupported method, same error path as today (500 via the existing `throw`; my call to keep the existing behaviour).
- Flag off and `useYiviKvk` on: Yivi stays hidden regardless.

### Task 1: FeatureFlags reader

**Files:**
- Create: `src/shared/FeatureFlags.ts`
- Test: `src/shared/tests/FeatureFlags.test.ts`

**Interfaces:**
- Produces: `class FeatureFlags { constructor(options?: { ssmClient?: SSMClient; ttlMs?: number; now?: () => number }); isEnabled(parameterName: string, defaultValue: boolean): Promise<boolean> }`. `ttlMs` default 60000. Cache is per parameter name.

- [ ] **Step 1: Write failing tests** (mock `SSMClient` with `mockClient`, `GetParameterCommand`, injected `now`):
  - `returns true for 'true' and false for 'false'`
  - `normalises casing and whitespace` (`'True'` → true, `' FALSE '` → false, `'yes'` → false)
  - `caches within ttl`: two calls, `ssmMock.commandCalls(GetParameterCommand)` length 1
  - `refetches after ttl`: advance `now` by 60001, length 2, returns the new value
  - `returns default when SSM throws`, `returns default when parameter not found`
  - `does not cache failures`: after an error, the next call hits SSM again
- [ ] **Step 2: Run** `npx jest src/shared/tests/FeatureFlags.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `FeatureFlags` in `src/shared/FeatureFlags.ts` (default `new SSMClient({ region: process.env.AWS_REGION })`; cache only successful reads).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: runtime feature flag reader backed by SSM`

### Task 2: Login handler honours the flag

**Files:**
- Modify: `src/app/login/loginRequestHandler.ts` (props interface L11-56, `addAuthMethods` L105-121)
- Modify: `src/app/login/login.lambda.ts` (handler L37-52)
- Test: `src/app/login/tests/login.test.ts`

**Interfaces:**
- Consumes: `FeatureFlags.isEnabled(parameterName: string, defaultValue: boolean): Promise<boolean>`.
- Produces: new optional prop `yiviSignicatEnabled?: boolean` on `LoginRequestHandlerProps` (undefined means enabled), documented as the runtime feature flag for Yivi via Signicat. Env var `FLAG_YIVI_SIGNICAT_PARAMETER` holds the parameter name.

- [ ] **Step 1: Write failing tests** in `login.test.ts` (yivi config as in the existing yivi test, plus `yiviSignicatEnabled: false`):
  - `hides the yivi button when yiviSignicatEnabled is false`: body does not match `method=yivi`, still matches `method=digid`
  - `rejects method=yivi when yiviSignicatEnabled is false`: `handleRequest(requestParams('', 'yivi'), …)` rejects with `'Authentication method is not suported!'`
  - `shows yivi when yiviSignicatEnabled is true or undefined`
  - `hides yivi when disabled even with useYiviKvk`
- [ ] **Step 2: Run** `npx jest src/app/login/tests/login.test.ts`. Expected: new tests FAIL.
- [ ] **Step 3: Implement**: in `addAuthMethods` require `this.config.yiviSignicatEnabled !== false` besides `yiviScope`. In `login.lambda.ts` add a module-level `const featureFlags = new FeatureFlags()` and pass `yiviSignicatEnabled: await featureFlags.isEnabled(process.env.FLAG_YIVI_SIGNICAT_PARAMETER ?? '', true)` when constructing the handler (an unset env var just yields the default via the reader's failure path).
- [ ] **Step 4: Run** the login suite. Expected: all PASS.
- [ ] **Step 5: Commit** `feat: hide Signicat Yivi login when yiviSignicat flag is off`

### Task 3: Infrastructure (parameter, env, IAM)

**Files:**
- Modify: `src/statics.ts` (after `ssmUseYiviKvk`, L30): `static readonly ssmFlagYiviSignicat: string = '/cdk/mijn-nijmegen/flags/yiviSignicat';`
- Modify: `src/ParameterStage.ts` (next to `ssm_config_2`, ~L55-60): `SSM.StringParameter` id `ssm_flag_yivi_signicat`, `stringValue: 'true'`, description noting it is changed by hand and read at runtime, and that the default must stay constant.
- Modify: `src/ApiStack.ts` `loginFunction()` (L270-299): env `FLAG_YIVI_SIGNICAT_PARAMETER: Statics.ssmFlagYiviSignicat`; `loginFunction.lambda.addToRolePolicy(new PolicyStatement({ actions: ['ssm:GetParameter'], resources: [<ARN of that parameter via Stack.of(this).formatArn({ service: 'ssm', resource: 'parameter', resourceName: <name without leading slash> })>] }))`.
- Test: `test/main.test.ts`

- [ ] **Step 1: Update/add tests**: `StackHasParameters` count 28 → 29; in ParameterStack add `template.hasResourceProperties('AWS::SSM::Parameter', { Name: '/cdk/mijn-nijmegen/flags/yiviSignicat', Value: 'true' })`; in ApiStack add `template.hasResourceProperties('AWS::IAM::Policy', …)` containing `ssm:GetParameter`, and the login function env `FLAG_YIVI_SIGNICAT_PARAMETER`.
- [ ] **Step 2: Run** `npx jest test/main.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the three file changes above.
- [ ] **Step 4: Run** `npx jest test/main.test.ts` then the full `npx jest`, then the project's build/lint (see `package.json` scripts; projen). Expected: PASS. If a snapshot or generated file (self-mutation) changes, include it.
- [ ] **Step 5: Commit** `feat: add yiviSignicat SSM flag and grant login lambda read access`

### Self-review notes
Spec coverage: flag reader (T1), page hides/rejects Yivi (T2), parameter + IAM + env (T3), no-redeploy flip documented in Phasing. Types consistent (`isEnabled`, `yiviSignicatEnabled`, `FLAG_YIVI_SIGNICAT_PARAMETER`). Manual check after deploy: `aws ssm put-parameter --name /cdk/mijn-nijmegen/flags/yiviSignicat --type String --value false --overwrite`, reload `/login` after ~1 minute.

---

# Full design (phase 2 context): VerID Yivi login next to Signicat, behind runtime flags

## Phasing (user decision)
- **Phase 1 (implement now): only the `yiviSignicat` flag.** Runtime SSM flag reader (`src/shared/FeatureFlags.ts`), the `/cdk/mijn-nijmegen/flags/yiviSignicat` parameter (default `'true'`, default must stay constant so deploys never overwrite a manual value), IAM grant + env on the login Lambda (and auth Lambda if it needs to reject Yivi callbacks), and the login-page change: the Yivi/Signicat button is hidden and `?method=yivi` is rejected when the flag is off. Tests for the flag reader and login handler.
- **Phase 2 (later):** the `yiviVerId` flag and the full VerID flow described below.
- Flipping the flag without a redeploy: edit the parameter in the SSM console or `aws ssm put-parameter --name /cdk/mijn-nijmegen/flags/yiviSignicat --type String --value false --overwrite`; effective after the ~60s cache.

## Context
Mijn Nijmegen authenticates via Signicat only (Yivi, DigiD, eHerkenning chosen by OIDC scope). VerID is the new multi-wallet platform and is expected to replace Yivi-via-Signicat. We add a VerID login path (OAuth code + PKCE via `@ver-id/node-client`) and two flags so the rollout can be flipped after deploy, without a redeploy.

## Goals
- Users can log in with a wallet via VerID and end up with the same session as today (Person from BSN).
- Flag `yiviSignicat`: turns the existing Signicat Yivi button/path off.
- Flag `yiviVerId`: turns the VerID button/path on.
- Flags flip in the SSM console and take effect within ~1 minute, no redeploy.

## Non-goals
- No change to DigiD / eHerkenning (stay on Signicat; assumption, confirmed implicitly by the request only mentioning Yivi).
- No organisation (KvK / `company` scope) login via VerID in this version. Persons only (user decision).
- No provider-interface refactor (user chose approach A).
- No IdP logout: VerID docs list no end-session endpoint; logout stays local.

## Approaches considered
- **A (chosen):** add VerID beside Signicat in the same `/login` and `/auth` routes, dispatch on the session `method`. Small diff, easy to delete the Signicat Yivi branch later.
- B: refactor to an `AuthProvider` interface first. Cleaner long term, but rewrites working DigiD/eHerkenning code for one provider.
- C: separate `/login/verid`, `/auth/verid` routes and Lambdas. Isolated, but duplicates session/BRP/OpenKlant handling and routing.
- Flags: runtime SSM read (chosen) over deploy-time SSM (`useYiviKvk` style, needs redeploy) and `Configuration.ts` booleans (needs a PR). SSM standard params and calls cost nothing at this scale.

## Design
**Flags** (SSM String params, created in `src/ParameterStage.ts`, names in `src/statics.ts`):
- `/cdk/mijn-nijmegen/flags/yiviSignicat` default `'true'`, `/cdk/mijn-nijmegen/flags/yiviVerId` default `'false'`. (Defaults are my call: nothing changes until VerID is switched on.)
- Small shared reader (e.g. `src/shared/FeatureFlags.ts`) using `@aws-sdk/client-ssm` `GetParameter`, in-memory cache ~60s, fail-safe to defaults on error. Login and auth Lambdas get `ssm:GetParameter` on those two params. Both Lambdas read the same flags so page and callback agree.

**Login** (`src/app/login/loginRequestHandler.ts`):
- `addAuthMethods`: show `yivi` only if `yiviScope` set AND `yiviSignicat` on; show new `verid` if `yiviVerId` on.
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
- Flag reader: cache, fallback to defaults on SSM error.
- `test/main.test.ts` CDK assertions for the new params, table, IAM grants; keep new `Configuration` fields optional.
- Existing Signicat Yivi/DigiD tests must stay green.

## Verification
`npx jest` for the touched suites and `test/main.test.ts`, then the project build/lint. End-to-end in development: set `yiviVerId=true` and `yiviSignicat=false` in SSM, check the login page, complete a login with a VerID test flow, confirm the session/home page, then flip back and confirm the buttons change within a minute.
