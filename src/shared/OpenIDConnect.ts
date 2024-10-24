import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Issuer, TokenSet, generators } from 'openid-client';

export class OpenIDConnect {
  issuer: Issuer;
  clientSecret?: string;

  /**
     * Helper class for our OIDC auth flow
     */
  constructor() {
    this.issuer = this.getIssuer();
  }

  /**
     * Retrieve client secret from secrets manager
     *
     * @returns string the client secret
     */
  async getOidcClientSecret() {
    if (!this.clientSecret) {
      const secretsManagerClient = new SecretsManagerClient({});
      const command = new GetSecretValueCommand({ SecretId: process.env.CLIENT_SECRET_ARN });
      const data = await secretsManagerClient.send(command);
      // Depending on whether the secret is a string or binary, one of these fields will be populated.
      if (data.SecretString) {
        this.clientSecret = data.SecretString;
      } else {
        console.error('no secret value found');
      }
    }
    return this.clientSecret;
  }

  /**
     * setup the oidc issuer. For now using env. parameters & hardcoded urls
     * Issuer could also be discovered based on file in .well-known, this
     * should be cached somehow.
     *
     * @returns openid-client Issuer
     */
  getIssuer(): Issuer {
    const issuer = new Issuer({
      issuer: `${process.env.AUTH_URL_BASE}/broker/sp/oidc`,
      authorization_endpoint: `${process.env.AUTH_URL_BASE}/broker/sp/oidc/authenticate`,
      token_endpoint: `${process.env.AUTH_URL_BASE}/broker/sp/oidc/token`,
      jwks_uri: `${process.env.AUTH_URL_BASE}/broker/sp/oidc/certs`,
      userinfo_endpoint: `${process.env.AUTH_URL_BASE}/broker/sp/oidc/userinfo`,
      revocation_endpoint: `${process.env.AUTH_URL_BASE}/broker/sp/oidc/token/revoke`,
      introspection_endpoint: `${process.env.AUTH_URL_BASE}/broker/sp/oidc/token/introspect`,
      end_session_endpoint: `${process.env.AUTH_URL_BASE}/broker/sp/oidc/logout`,
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      introspection_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      revocation_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      revocation_endpoint_auth_signing_alg_values_supported: ['RS256'],
    });
    return issuer;
  }

  /**
     * Get the login url for the OIDC-provider.
     * @param {string} state A string parameter that gets returned in the auth callback.
     * This should be checked before accepting the login response.
     * @returns {string} the login url
     */
  getLoginUrl(state: string, scope?: string): string {
    if (!scope) {
      scope = process.env.OIDC_SCOPE;
    }
    if (!scope) {
      throw Error('no scope provided in constructor or process.env.OIDC_SCOPE');
    }

    if (!process.env.APPLICATION_URL_BASE || !process.env.OIDC_CLIENT_ID) {
      throw Error('no APPLICATION_URL_BASE or OIDC_CLIENT_ID in env. provided.');
    }
    const base_url = new URL(process.env.APPLICATION_URL_BASE);
    const redirect_uri = new URL('/auth', base_url);
    const client = new this.issuer.Client({
      client_id: process.env.OIDC_CLIENT_ID,
      redirect_uris: [redirect_uri.toString()],
      response_types: ['code'],
    });
    const authUrl = client.authorizationUrl({
      scope,
      resource: process.env.AUTH_URL_BASE,
      state: state,
    });
    return authUrl;
  }

  /**
     * Use the returned code from the OIDC-provider and stored state param
     * to complete the login flow.
     *
     * @param {string} code
     * @param {string} state
     * @returns {TokenSet} returns the tokens object on succesful auth
     */
  async authorize(code: string, state: string, returnedState: string): Promise<TokenSet> {
    if (!process.env.APPLICATION_URL_BASE || !process.env.OIDC_CLIENT_ID) {
      throw Error('no APPLICATION_URL_BASE or OIDC_CLIENT_ID in env. provided.');
    }
    const base_url = new URL(process.env.APPLICATION_URL_BASE);
    const redirect_uri = new URL('/auth', base_url);
    const client_secret = await this.getOidcClientSecret();
    const client = new this.issuer.Client({
      client_id: process.env.OIDC_CLIENT_ID,
      redirect_uris: [redirect_uri.toString()],
      client_secret: client_secret,
      response_types: ['code'],
    });
    const params = client.callbackParams(redirect_uri + '/?code=' + code + '&state=' + returnedState);
    if (state !== returnedState) {
      throw new Error('state does not match session state');
    }
    let tokenSet;
    try {
      tokenSet = await client.callback(redirect_uri.toString(), params, { state: state });
    } catch (err: any) {
      throw new Error(`${err.error} ${err.error_description}`);
    }
    const claims = tokenSet.claims();
    if (claims.aud != process.env.OIDC_CLIENT_ID) {
      throw new Error('claims aud does not match client id');
    }
    return tokenSet;

  }

  generateState() {
    return generators.state();
  }
}