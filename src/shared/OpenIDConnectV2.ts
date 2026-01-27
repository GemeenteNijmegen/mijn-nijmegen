import { randomUUID } from 'crypto';
import * as oidc from 'openid-client';

export interface OpenIDConnectConfiguration {
  wellknown: string;
  clientId: string;
  clientSecret: string;
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
    const authorized = await oidc.authorizationCodeGrant(oidcConfiguration, url, {
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
        client_secret: this.configuration.clientSecret,
        client_id: this.configuration.clientId,
      });
    }
    return this.oidcConfiguration;
  }


}