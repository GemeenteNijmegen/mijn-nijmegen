import { AWS } from '@gemeentenijmegen/utils';
import * as jwt from 'jsonwebtoken';
import { User } from '../../shared/User';

interface MijnServicesAggregatorConnectorOptions {
  /**
   * The baseurl for the api you're connecting to
   */
  baseUrl: URL;

  /**
   * The secret name for the AWS secret the apikey is stored in
   * This will be used to (lazily) retrieve the API key on first use
   */
  apiKeySecretName: string;

  /**
   * If set, the fetch will abort after this amount of time, throwing
   * an error. You're expected to handle this error yourself.
   * On timeout, the error will be of type `DOMException` with the name `TimeoutError`
   */
  timeout?: number;

}

/**
 * Manages connections to the zaakaggregator service
 */
export class MijnServicesAggregatorConnector {
  private keyName: string;
  private clientId?: string;
  private clientSecret?: string;
  private baseUrl: URL;
  private timeout?: number;

  constructor(options: MijnServicesAggregatorConnectorOptions) {
    this.keyName = options.apiKeySecretName;
    this.baseUrl = options.baseUrl;
    this.timeout = options.timeout;
  }

  setTimeout(timeout: number) {
    this.timeout = timeout;
  }

  async getJwtToken(): Promise<string> {
    if (!this.clientId || this.clientSecret) {
      const secret = await AWS.getSecret(this.keyName);
      const parsed = JSON.parse(secret);
      if (!parsed.clientId || !parsed.clientSecret) {
        throw Error('No MijnServicesAggregator credentials found (should be json object with clientId and clientSecret)');
      }
      this.clientId = parsed.clientId;
      this.clientSecret = parsed.clientSecret;
    }
    return jwt.sign(
      {
        iss: this.clientId,
        iat: Math.floor(Date.now() / 1000),
        client_id: this.clientId,
        user_id: this.clientId,
        user_representation: this.clientId,
      },
      this.clientSecret,
      { expiresIn: '1h' },
    );
  }

  async fetch(endpoint: string, user: User, params?: URLSearchParams) {
    const url = this.createUrlForRequest(endpoint, user, params);
    const token = await this.getJwtToken();
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/octet-stream,application/json',
          'Content-Type': 'application/json',
        },
        signal: (this.timeout) ? AbortSignal.timeout(this.timeout) : undefined,
      });
      const json = await response.json() as any;
      if (process.env.DEBUG == 'True') {
        console.debug(`response for ${endpoint}`, JSON.stringify(json));
      }
      return json;
    } catch (err) {
      console.info('fetch error', err);
      throw err;
    }
  }

  private createUrlForRequest(endpoint: string, user: User, params?: URLSearchParams) {
    const url = new URL(this.baseUrl);
    url.pathname = endpoint;
    const allParams = new URLSearchParams({
      userType: user.type,
      userIdentifier: user.identifier,
    });
    if (params) {
      for (let [key, val] of params.entries()) {
        allParams.append(key, val);
      }
    }
    url.search = allParams.toString();
    return url;
  }
}
