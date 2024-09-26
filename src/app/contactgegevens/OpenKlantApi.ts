import { AWS } from '@gemeentenijmegen/utils';


export class OpenklantApi {

  private endpoint: string;
  private apikey?: string;

  constructor(endpoint?: string, apikey?: string) {
    this.endpoint = endpoint ? endpoint : process.env.OPENKLANT_API_ENDPOINT!;
    this.apikey = apikey;
  }

  async getApiKey() {
    if (!this.apikey) {
      if (!process.env.OPENKLANT_API_KEY) {
        throw Error('Missing OPENKLANT_API_KEY');
      }
      this.apikey = await AWS.getSecret(process.env.OPENKLANT_API_KEY);
    }
    return this.apikey;
  }

  async getPartijWithDigitaleAdresen(userType: 'persoon' | 'organization', userIdentifier: string) {
    console.log('GET', this.endpoint, 'partijen');

    const partyIdentifier = userType == 'persoon' ? 'Burgerservicenummer' : 'Kvknummer';

    const url = new URL(this.endpoint + '/partijen');
    url.searchParams.set('partijIdentificator__codeSoortObjectId', partyIdentifier);
    url.searchParams.set('partijIdentificator__objectId', userIdentifier);
    url.searchParams.set('expand', 'digitaleAdressen');

    try {

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Token ${await this.getApiKey()}`,
        },
      });
      const json = await response.json() as any;

      if (json.count == 0 || json.count > 1) {
        throw Error('Multiple partijen found, one expected');
      }
      return json.results[0];

    } catch (err) {
      console.error(err);
      throw Error('Could not get partij');
    }

  }


}
