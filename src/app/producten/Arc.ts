import { AWS } from '@gemeentenijmegen/utils';
import * as jwt from 'jsonwebtoken';

/** This class connect to the ARC, which returns a redirect url */
export class Arc {
  private apiKey?: string;
  constructor(private endpoint: string, private keyArn: string) { }

  public async getRedirectUrl(productId: string, payload: any = {}) {
    const secret = await this.getApiKey();
    const token = jwt.sign(payload, secret);

    const result = await fetch(`${this.endpoint}?type=product&productId=${productId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
    });
    try {
      const json = await result.json() as any;
      return json.url;
    } catch (err: any) {
      console.error('unexpected response,', err);
    }
  }

  private async getApiKey() {
    if (!this.apiKey) {
      this.apiKey = await AWS.getSecret(this.keyArn);
    }
    return this.apiKey;
  }
}
