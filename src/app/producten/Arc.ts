import { AWS } from '@gemeentenijmegen/utils';

/** This class connect to the ARC, which returns a redirect url */
export class Arc {
  private apiKey?: string;
  constructor(private endpoint: string, private keyArn: string) { }

  public async getRedirectUrl(productId: string) {
    const result = await fetch(`${this.endpoint}?type=producten&productId=${productId}`, {
      method: 'GET',
      headers: {
        'x-api-key': await this.getApiKey(),
      },
    });
    try {
      const json = await result.json() as any;
      if (!json.url || typeof json.url !== 'string') {
        throw new Error('ARC did not return a valid url.');
      }
      return json.url;
    } catch (err: any) {
      console.error('unexpected response from arc,', err);
      throw Error('Could not get redirect url from ARC');
    }
  }

  private async getApiKey() {
    if (!this.apiKey) {
      this.apiKey = await AWS.getSecret(this.keyArn);
    }
    return this.apiKey;
  }
}
