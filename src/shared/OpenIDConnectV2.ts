import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { ClientMetadata, Issuer, TokenSet, generators } from 'openid-client';

export interface OpenIDConnectConfiguration {
  wellknown: string;
  clientId: string;
  clientSecretArn?: string;
  redirectUrl: string;
  clientOptions?: Partial<ClientMetadata>;
}

export class OpenIDConnectV2 {

  private readonly configuration: OpenIDConnectConfiguration;
  private issuer?: Issuer;
  private clientSecret?: string;

  /**
   * Helper class for our OIDC auth flow
   */
  constructor(configuration: OpenIDConnectConfiguration) {
    this.configuration = configuration;
  }

  /**
   * Get the login url for the OIDC-provider.
   * @param {string} state A string parameter that gets returned in the auth callback.
   * This should be checked before accepting the login response.
   * @returns {string} the login url
   */
  async getLoginUrl(state: string, scope: string): Promise<string> {
    const issuer = await this.getIssuer();
    const redirectUrl = this.configuration.redirectUrl;
    const client = new issuer.Client({
      client_id: this.configuration.clientId,
      redirect_uris: [redirectUrl],
      response_types: ['code'],
    });
    if (!this.issuer?.metadata.authorization_endpoint) {
      throw Error('Authorization endpoint not configured in issuer (used discovery)');
    }
    const authUrl = client.authorizationUrl({
      scope,
      resource: issuer.metadata.authorization_endpoint,
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
    const issuer = await this.getIssuer();
    const clientSecret = await this.getOidcClientSecret();

    const redirectUrl = this.configuration.redirectUrl;
    const client = new issuer.Client({
      client_id: this.configuration.clientId,
      redirect_uris: [redirectUrl],
      client_secret: clientSecret,
      response_types: ['code'],
      ...this.configuration.clientOptions,
    });
    const params = client.callbackParams(redirectUrl + '/?code=' + code + '&state=' + returnedState);
    if (state !== returnedState) {
      console.debug(state, returnedState);
      throw new Error('state does not match session state');
    }
    console.debug('State matches session state');
    let tokenSet;
    try {
      console.debug('Doing callback with', redirectUrl, params, state);
      console.debug(JSON.stringify(client.metadata));
      tokenSet = await client.callback(redirectUrl, params, { state: state });
    } catch (err: any) {
      throw new Error(`${err.error} ${err.error_description}`);
    }
    const claims = tokenSet.claims();
    if (claims.aud != this.configuration.clientId) {
      throw new Error('claims aud does not match client id');
    }
    return tokenSet;

  }

  generateState() {
    return generators.state();
  }

  /**
   * setup the oidc issuer. For now using env. parameters & hardcoded urls
   * Issuer could also be discovered based on file in .well-known, this
   * should be cached somehow.
   * @returns openid-client Issuer
   */
  private async getIssuer(): Promise<Issuer> {
    if (!this.issuer) {
      this.issuer = await Issuer.discover(this.configuration.wellknown);
    }
    return this.issuer;
  }

  /**
   * Retrieve client secret from secrets manager
   * @returns string the client secret
   */
  private async getOidcClientSecret() {
    if (!this.clientSecret) {
      if (!this.configuration.clientSecretArn) {
        throw Error('Client secret arn not configured, cannot load client secret.');
      }
      const secretsManagerClient = new SecretsManagerClient({});
      const command = new GetSecretValueCommand({ SecretId: this.configuration.clientSecretArn });
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

}