import { Logger } from '@aws-lambda-powertools/logger';
import { AWS } from '@gemeentenijmegen/utils';
import { OpenKlantDigitaalAdres, OpenKlantDigitaalAdresWithUuid, OpenKlantPartij, OpenKlantPartijIdentificiatie, OpenKlantPartijIdentificiatieWithUuid, OpenKlantPartijWithUuid, QueryOpenKlantPartijWithUuid } from './model/partij';
import { User } from '../../shared/User';


export enum SoortDigitaalAdres {
  EMAIL = 'email',
  TELEFOONNUMMER = 'telefoonnummer',
}

export interface IOpenKlantAPI {
  createNatuurlijkPersoon(naam: string): Promise<OpenKlantPartijWithUuid>;
  addPartijIdentificatie(user: User, partijUuid: string): Promise<OpenKlantPartijIdentificiatieWithUuid>;
  createDigitaalAdress(partijUuid: string, type: 'email' | 'telefoonnummer', adres: string): Promise<OpenKlantDigitaalAdresWithUuid>;
  updateDigitaalAdress(uuid: string, adres: string): Promise<OpenKlantDigitaalAdresWithUuid>;
  updatePartij(partij: any): Promise<OpenKlantPartijWithUuid>;
  deleteDigitaalAdress(uuid: string): Promise<void>;
  getPartijWithDigitaleAdresen(user: User): Promise<OpenKlantPartijWithUuid | undefined>;
}

export class OpenklantApi implements IOpenKlantAPI {

  private logger: Logger;
  private endpoint: string;
  private apikey?: string;

  constructor(endpoint: string | undefined, apikey: string | undefined, logger: Logger) {
    this.endpoint = endpoint ? endpoint : process.env.OPENKLANT_API_ENDPOINT!;
    this.apikey = apikey;
    this.logger = logger;
  }

  async createNatuurlijkPersoon(naam: string): Promise<OpenKlantPartijWithUuid> {
    const input: OpenKlantPartij = {
      soortPartij: 'persoon',
      indicatieActief: true,
      indicatieGeheimhouding: false,
      rekeningnummers: [],
      digitaleAdressen: [],
      voorkeursDigitaalAdres: null,
      voorkeursRekeningnummer: null,
      voorkeurstaal: 'dut',
      partijIdentificatie: {
        contactnaam: null,
        naam: naam,
        volledigeNaam: naam,
      },
    };
    try {
      const url = new URL(this.endpoint + '/partijen');
      return await this.callApi('POST', url, input);
    } catch (err) {
      this.logger.error('Error', { err });
      throw Error('Could not create partij');
    }

  }

  async addPartijIdentificatie(user: User, partijUuid: string): Promise<OpenKlantPartijIdentificiatieWithUuid> {

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
      this.logger.error('Error', { err });
      throw Error('Could not create partij');
    }

  }

  async createDigitaalAdress(partijUuid: string, type: 'email' | 'telefoonnummer', adres: string): Promise<OpenKlantDigitaalAdresWithUuid> {
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
      this.logger.error('Error', { err });
      throw Error('Could not digitaal adress');
    }
  }

  async updateDigitaalAdress(uuid: string, adres: string): Promise<OpenKlantDigitaalAdresWithUuid> {
    try {
      const url = new URL(this.endpoint + `/digitaleadressen/${uuid}`);
      return await this.callApi('PATCH', url, { adres });
    } catch (err) {
      this.logger.error('Error', { err });
      throw Error('Could not update digitaal adres');
    }
  }

  async deleteDigitaalAdress(uuid: string) {
    try {
      const url = new URL(this.endpoint + `/digitaleadressen/${uuid}`);
      return await this.callApiWithoutResponse('DELETE', url);
    } catch (err) {
      this.logger.error('Error', { err });
      throw Error('Could not delete digitaal adres');
    }
  }

  async getPartijWithDigitaleAdresen(user: User): Promise<OpenKlantPartijWithUuid | undefined> {
    const partyIdentifier = user.type == 'person' ? 'Burgerservicenummer' : 'Kvknummer';

    const url = new URL(this.endpoint + '/partijen');
    url.searchParams.set('partijIdentificator__codeSoortObjectId', partyIdentifier);
    url.searchParams.set('partijIdentificator__objectId', user.identifier);
    url.searchParams.set('expand', 'digitaleAdressen');

    try {
      const json = await this.callApi<QueryOpenKlantPartijWithUuid>('GET', url);
      if (json.count == 0) {
        return undefined;
      }
      if (json.count > 1) {
        throw Error('Multiple partijen found, one expected');
      }
      return json.results[0];

    } catch (err) {
      this.logger.error('Error', { err });
      throw Error('Could not get partij');
    }

  }

  async updatePartij(partij: OpenKlantPartijWithUuid): Promise<OpenKlantPartijWithUuid> {
    try {
      const url = new URL(this.endpoint + `/partijen/${partij.uuid}`);
      return await this.callApi('PATCH', url, partij);
    } catch (err) {
      this.logger.error('Error', { err });
      throw Error('Could not update partij');
    }
  }

  private async callApi<T>(method: string, url: URL, data?: any): Promise<T> {
    const response = await fetch(url.toString(), {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${await this.getApiKey()}`,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    this.logger.debug(`${method} to ${url.pathname} - ${response.status}`);
    if (!response.ok) {
      this.logger.debug('Received response', { responseBody: await response.text() });
      throw Error('API call returned a non 2xx status code.');
    }
    const json = await response.json() as any;
    return json;
  }

  private async callApiWithoutResponse(method: string, url: URL, data?: any): Promise<void> {
    const response = await fetch(url.toString(), {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${await this.getApiKey()}`,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    this.logger.debug(`${method} to ${url.pathname} - ${response.status}`);
    if (!response.ok) {
      this.logger.debug('Received response', { responseBody: await response.text() });
    }
    return;
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
  updatePartij(_partij: OpenKlantPartijWithUuid): Promise<OpenKlantPartijWithUuid> {
    throw Error('This method should be mocked.');
  }
  async updateDigitaalAdress(_uuid: string, _adres: string): Promise<OpenKlantDigitaalAdresWithUuid> {
    throw Error('This method should be mocked');
  }
  async deleteDigitaalAdress(_uuid: string) {
    throw Error('This method should be mocked');
  }
  async createDigitaalAdress(_partijUuid: string, _type: 'email' | 'telefoonnummer', _adres: string): Promise<OpenKlantDigitaalAdresWithUuid> {
    throw Error('This method should be mocked');
  }
  async createNatuurlijkPersoon(_naam: string): Promise<OpenKlantPartijWithUuid> {
    throw Error('This method should be mocked');
  }
  async addPartijIdentificatie(_user: User, _partijUuid: string): Promise<OpenKlantPartijIdentificiatieWithUuid> {
    throw Error('This method should be mocked');
  }
  async getPartijWithDigitaleAdresen(_user: User): Promise<OpenKlantPartijWithUuid> {
    throw Error('This method should be mocked');
  }
}
