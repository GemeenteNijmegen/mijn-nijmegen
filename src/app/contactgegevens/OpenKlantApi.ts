import { AWS } from '@gemeentenijmegen/utils';
import { User } from '../zaken/User';
import { OpenKlantDigitaalAdres, OpenKlantDigitaalAdresWithUuid, OpenKlantPartij, OpenKlantPartijIdentificiatie, OpenKlantPartijIdentificiatieWithUuid, OpenKlantPartijWithUuid } from './model/partij';

export interface IOpenKlantAPI {
  createNatuurlijkPersoon(): Promise<OpenKlantPartijWithUuid>;
  addPartijIdentificatie(user: User, partijUuid: string) : Promise<OpenKlantPartijIdentificiatieWithUuid>;
  setDigitaalAdress(user: User, partijUuid: string, type: 'email' | 'telefoonnummer', adres: string) : Promise<OpenKlantDigitaalAdresWithUuid>;
  getPartijWithDigitaleAdresen(user: User) : Promise<OpenKlantPartijWithUuid | undefined>;
}

export class OpenklantApi implements IOpenKlantAPI {

  private endpoint: string;
  private apikey?: string;

  constructor(endpoint?: string, apikey?: string) {
    this.endpoint = endpoint ? endpoint : process.env.OPENKLANT_API_ENDPOINT!;
    this.apikey = apikey;
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
      return await this.callApi('POST', url, input);
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
      const url = new URL(this.endpoint + '/partij-identificatoren');
      return await this.callApi('POST', url, input);
    } catch (err) {
      console.error(err);
      throw Error('Could not create partij');
    }

  }

  async setDigitaalAdress(user: User, partijUuid: string, type: 'email' | 'telefoonnummer', adres: string): Promise<OpenKlantDigitaalAdresWithUuid> {

    if (user.type != 'person') {
      throw Error('Only persons supported for now!');
    }

    const input: OpenKlantDigitaalAdres = {
      verstrektDoorPartij: { uuid: partijUuid },
      verstrektDoorBetrokkene: null,
      soortDigitaalAdres: type,
      adres: adres,
      omschrijving: type,
    };

    try {
      const url = new URL(this.endpoint + '/digitaleadressen');
      return await this.callApi('POST', url, input);
    } catch (err) {
      console.error(err);
      throw Error('Could not digitaal adress');
    }
  }

  async getPartijWithDigitaleAdresen(user: User) : Promise<OpenKlantPartijWithUuid | undefined> {
    const partyIdentifier = user.type == 'person' ? 'Burgerservicenummer' : 'Kvknummer';

    const url = new URL(this.endpoint + '/partijen');
    url.searchParams.set('partijIdentificator__codeSoortObjectId', partyIdentifier);
    url.searchParams.set('partijIdentificator__objectId', user.identifier);
    url.searchParams.set('expand', 'digitaleAdressen');

    try {
      const json = await this.callApi('GET', url);
      if (json.count == 0) {
        return undefined;
      }
      if (json.count > 1) {
        throw Error('Multiple partijen found, one expected');
      }
      return json.results[0];

    } catch (err) {
      console.error(err);
      throw Error('Could not get partij');
    }

  }

  private async callApi(method: string, url: URL, data?: any) {
    const response = await fetch(url.toString(), {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${await this.getApiKey()}`,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    console.debug(method, 'to', url.pathname, '-', response.status);
    if(!response.ok){
      console.debug('Received response', await response.text());
    }
    const json = await response.json() as any;
    return json;
  }

  private async getApiKey() {
    if (!this.apikey) {
      if (!process.env.OPENKLANT_API_KEY_ARN) {
        throw Error('Missing OPENKLANT_API_KEY_ARN');
      }
      this.apikey = await AWS.getSecret(process.env.OPENKLANT_API_KEY_ARN);
    }
    return this.apikey;
  }

}

export class OpenKlantAPIMock implements IOpenKlantAPI {
  setDigitaalAdress(_user: User, _partijUuid: string, _type: 'email' | 'telefoonnummer', _adres: string): Promise<OpenKlantDigitaalAdresWithUuid> {
    throw Error('This method should be mocked');
  }
  async createNatuurlijkPersoon(): Promise<OpenKlantPartijWithUuid> {
    throw Error('This method should be mocked');
  }
  async addPartijIdentificatie(_user: User, _partijUuid: string) : Promise<OpenKlantPartijIdentificiatieWithUuid> {
    throw Error('This method should be mocked');
  }
  async getPartijWithDigitaleAdresen(_user: User) : Promise<OpenKlantPartijWithUuid> {
    throw Error('This method should be mocked');
  }
}
