import { AWS } from '@gemeentenijmegen/utils';
import { User } from '../zaken/User';


export class OpenklantApi {

  private endpoint: string;
  private apikey?: string;

  constructor(endpoint?: string, apikey?: string) {
    this.endpoint = endpoint ? endpoint : process.env.OPENKLANT_API_ENDPOINT!;
    this.apikey = apikey;
  }

  async getApiKey() {
    if (!this.apikey) {
      if (!process.env.OPENKLANT_API_KEY_ARN) {
        throw Error('Missing OPENKLANT_API_KEY_ARN');
      }
      this.apikey = await AWS.getSecret(process.env.OPENKLANT_API_KEY_ARN);
    }
    return this.apikey;
  }

  async getPartijWithDigitaleAdresen(user: User) {
    console.log('GET', this.endpoint, 'partijen');

    const partyIdentifier = user.type == 'person' ? 'Burgerservicenummer' : 'Kvknummer';

    const url = new URL(this.endpoint + '/partijen');
    url.searchParams.set('partijIdentificator__codeSoortObjectId', partyIdentifier);
    url.searchParams.set('partijIdentificator__objectId', user.identifier);
    url.searchParams.set('expand', 'digitaleAdressen');

    try {

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Token ${await this.getApiKey()}`,
        },
      });
      console.debug('Called open-klant', response.status);
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

  /**
   * 
   * TODO support for PseudoID and user
   * @param user 
   */
  // async createPartijWithDigitaleAddressen(user: User, emailAdres: string | undefined, phonenumber: string | undefined){
    // If user is a organization
    //  - Check if the contactpersoon exists based on PseudoID
    //  - If the contactpersoon exists
    //     - Update email / phone
    //  - If the contactpersoon does not exist
    //      - Create / get organization
    //      - Create contactpersoon in organization

    // If user is a person
    //  - Check if the user exists
    //  - If the user exists -> Update email / phone
    //  - If the user does not exists -> Create user + digitale adressen
  // }

}

