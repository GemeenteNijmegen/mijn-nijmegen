import { randomUUID } from 'crypto';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import * as oidc from 'openid-client';

export interface OpenIDConnectConfiguration {
  wellknown: string;
  clientId: string;
  clientSecretArn?: string;
  redirectUrl: string;
  clientOptions?: Partial<oidc.ClientMetadata>;
}

export interface OpenIDConnectResult {
  claims: oidc.IDToken;
  scopes: string[];
}

export class OpenIDConnectV2 {

  private readonly configuration: OpenIDConnectConfiguration;
  private oidcConfiguration?: oidc.Configuration;
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
  async getLoginUrl(state: string, scope: string, additionalOptions?: Record<string, string>): Promise<string> {
    const oidcConfiguration = await this.getOidcConfiguration();
    const redirectUrl = this.configuration.redirectUrl;

    const parameters: Record<string, string> = {
      redirect_uri: redirectUrl,
      response_types: 'code',
      scope,
      state: state,
      ...additionalOptions,
    };
    const authUrl = oidc.buildAuthorizationUrl(oidcConfiguration, parameters);
    return authUrl.toString();
  }

  /**
   * Use the returned code from the OIDC-provider and stored state param
   * to complete the login flow.
   *
   * @param {string} url - the url requested for callback (includes code and state)
   * @param {string} expectedState - The state we have stored in the session
   * @returns {any} returns the parsed claims from either the id_token or the userinfo endpoint
   */
  async authorize(url: URL, expectedState: string): Promise<OpenIDConnectResult> {

    const oidcConfiguration = await this.getOidcConfiguration();
    const redirectUrl = new URL(this.configuration.redirectUrl);
    const authorized = await oidc.authorizationCodeGrant(oidcConfiguration, redirectUrl, {
      expectedState: expectedState,
    });

    if (!authorized.access_token) {
      throw new Error('No access token returned from idp');
    }

    const claims = authorized.claims();
    if (!claims || !authorized.scope) {
      throw Error('No ID token or scope found in idp response');
    }

    return {
      scopes: authorized.scope ? authorized.scope.split(' ') : [],
      claims: authorized.claims()!,
    };

  }

  generateState() {
    return randomUUID();
  }

  /**
   * setup the oidc issuer. For now using env. parameters & hardcoded urls
   * Issuer could also be discovered based on file in .well-known, this
   * should be cached somehow.
   * @returns openid-client Configuration
   */
  private async getOidcConfiguration(): Promise<oidc.Configuration> {
    if (!this.oidcConfiguration) {
      const url = new URL(this.configuration.wellknown);
      this.oidcConfiguration = await oidc.discovery(url, this.configuration.clientId, {
        client_secret: await this.getOidcClientSecret(),
        client_id: this.configuration.clientId,
      });
    }
    return this.oidcConfiguration;
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