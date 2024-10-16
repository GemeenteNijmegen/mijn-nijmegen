import { AWS } from '@gemeentenijmegen/utils';
import { User } from './User';

interface ZakenAggregatorConnectorOptions {
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
export class ZakenAggregatorConnector {
  private keyName: string;
  private apiKey?: string;
  private baseUrl: URL;
  private timeout?: number;

  constructor(options: ZakenAggregatorConnectorOptions) {
    this.keyName = options.apiKeySecretName;
    this.baseUrl = options.baseUrl;
    this.timeout = options.timeout;
  }

  setTimeout(timeout: number) {
    this.timeout = timeout;
  }

  async getApiKey(): Promise<string> {
    if (!this.apiKey) {
      this.apiKey = await AWS.getSecret(this.keyName);
      if (!this.apiKey) {
        throw Error('No API key found');
      }
    }
    return this.apiKey;
  }

  async fetch(endpoint: string, user: User, params?: URLSearchParams) {
    const url = this.createUrlForRequest(endpoint, user, params);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': await this.getApiKey(),
        },
        signal: (this.timeout) ? AbortSignal.timeout(this.timeout) : undefined,
      });
      const json = await response.json() as any;
      return json;
    } catch (err) {
      console.info(err);
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
