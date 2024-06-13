

export class OurOwnIdentityProvider {
  readonly url: string;
  readonly client_id: string;
  readonly client_secret: string;

  constructor(url: string, client_id: string, client_secret: string) {
    this.url = url;
    this.client_id = client_id;
    this.client_secret = client_secret;
  }

  async exchangeToken(access_token: string) {
    const response = await fetch(this.url, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: this.client_id,
        client_secret: this.client_secret,
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: access_token,
        subject_token_type: 'Bearer',
      }),
    });
    const tokenResponse = await response.json() as any;
    return tokenResponse.access_token;
  }

}