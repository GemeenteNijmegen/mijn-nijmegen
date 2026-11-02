/**
 * All values for the local MiniStack setup in one place. Nothing in here is
 * a real secret or a real endpoint - see test/local/README.md.
 */
export const localConfig = {
  /**
   * MiniStack's default fake account id. Matches the `cdk bootstrap` call in
   * scripts/local.sh.
   */
  account: '000000000000',
  /**
   * Same region as production (see Statics.gnMijnNijmegen*Environment).
   * docker-compose.yml sets MINISTACK_REGION to the same value.
   */
  region: 'eu-central-1',
  /**
   * Pinned HTTP API id (MiniStack's `ms-custom-id` tag), so the proxy in
   * proxy/Caddyfile can use a fixed upstream path.
   */
  apiId: 'mijn-nijmegen',
  /**
   * Where the app is reached in the browser: the Caddy proxy, which takes
   * CloudFront's role locally.
   */
  applicationUrl: 'http://localhost:3000',
  /**
   * Prefix for all pinned Lambda function names, so their log groups are
   * predictable (`/aws/lambda/local-<name>`, see scripts/local.sh logs).
   */
  functionNamePrefix: 'local-',
  /**
   * Keycloak, standing in for DigiD and eHerkenning. Must match the client
   * and client scopes in keycloak/realm-mijn-nijmegen.json.
   */
  oidc: {
    clientId: 'mijn-nijmegen',
    clientSecret: 'local-dev-oidc-client-secret',
    // The lambdas reach Keycloak by its service name; the browser uses
    // localhost:8081. See KC_HOSTNAME_BACKCHANNEL_DYNAMIC in docker-compose.yml.
    wellKnown: 'http://keycloak:8080/realms/mijn-nijmegen/.well-known/openid-configuration',
    scope: 'openid',
    digidScope: 'digid',
    eherkenningScope: 'eherkenning',
  },
  /**
   * Backends, all answered by the WireMock container (`backend-mock`) under
   * a hostname alias per backend. See wiremock/mappings.
   */
  backends: {
    haalCentraalBaseUrl: 'http://haalcentraal.backend-mock:8080/haalcentraal/api/brp',
    zaakAggregatorBaseUrl: 'http://zaakaggregator.backend-mock:8080/',
    uitkeringenUrl: 'http://uitkeringen.backend-mock:8080/uitkeringen/mijnNijmegenData',
  },
  /**
   * Value for every secret or parameter the mocks don't check (API keys,
   * mTLS key and certificate). The backends are plain http, so the mTLS
   * values are never used for a TLS handshake.
   */
  unusedSecretValue: 'not-used-locally',
};
