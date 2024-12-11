import { AWS } from '@gemeentenijmegen/utils';
import { User } from '../zaken/User';
import { OpenKlantPartij, OpenKlantPartijIdentificiatie, OpenKlantPartijIdentificiatieWithUuid, OpenKlantPartijWithUuid } from './model/partij';


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

  async createNatuurlijkPersoon(): Promise<OpenKlantPartijWithUuid> {
    const input: OpenKlantPartij = {
      soortPartij: 'persoon',
      indicatieActief: true,
      indicatieGeheimhouding: false,
      rekeningnummers: [],
      digitaleAdressen: [],
      voorkeursDigitaalAdres: null,
      voorkeursRekeningnummer: null,
      voorkeurstaal: 'dut',
    };
    try {
      const url = new URL(this.endpoint + '/partijen');
      return await this.callApi(url.toString(), input);
    } catch (err) {
      console.error(err);
      throw Error('Could not create partij');
    }

  }

  async addPartijIdentificatie(user: User, partijUuid: string) : Promise<OpenKlantPartijIdentificiatieWithUuid> {

    if (user.type != 'person') {
      throw Error('Only persons supported for now!');
    }

    const input: OpenKlantPartijIdentificiatie = {
      partijIdentificator: {
        codeRegister: 'BRP',
        codeSoortObjectId: 'Burgerservicenummer',
        objectId: user.identifier,
      },
      identificeerdePartij: { uuid: partijUuid },
    };

    try {
      const url = new URL(this.endpoint + '/partij-identificatie');
      return await this.callApi(url.toString(), input);
    } catch (err) {
      console.error(err);
      throw Error('Could not create partij');
    }

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

  private async callApi(url: string, data?: any) {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Token ${await this.getApiKey()}`,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    console.debug('POST to', url.toString(), '-', response.status);
    const json = await response.json() as any;
    return json;
  }


}

