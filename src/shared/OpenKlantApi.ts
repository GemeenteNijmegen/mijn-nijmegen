import { Bsn } from '@gemeentenijmegen/utils';
import { ApiClient } from './ApiClient';

interface Config {
  readonly baseUrl: string;
  readonly apiclient: ApiClient;
}

interface DigitaalAdres {
  adres: string;
  soortDigitaalAdres: 'email' | 'telefoonnummer';
}

interface Partij {
  uuid: string;
  digitaleAdressen?: DigitaalAdres[];
}

interface PartijResponse {
  count: number;
  results: Partij[];
}

export interface ContactInfo {
  email?: string;
  phonenumber?: string;
}

export class OpenKlantApi {

  constructor(private config: Config) { }

  async getContactInfo(identifier: string, type: 'person' | 'organisation'): Promise<ContactInfo> {
    const filterField = type === 'person'
      ? 'partijIdentificator__codeSoortObjectId=bsn'
      : 'partijIdentificator__codeSoortObjectId=kvk';

    const url = `${this.config.baseUrl}/klantinteracties/api/v1/partijen?${filterField}&partijIdentificator__objectId=${identifier}&expand=digitaleAdressen`;

    const data: PartijResponse = await this.config.apiclient.getData(url);

    if (!data?.results || data.results.length === 0) {
      throw Error('No partij found for identifier');
    }

    const partij = data.results[0];
    const contactInfo: ContactInfo = {};

    if (partij.digitaleAdressen) {
      for (const adres of partij.digitaleAdressen) {
        if (adres.soortDigitaalAdres === 'email' && !contactInfo.email) {
          contactInfo.email = adres.adres;
        } else if (adres.soortDigitaalAdres === 'telefoonnummer' && !contactInfo.phonenumber) {
          contactInfo.phonenumber = adres.adres;
        }
      }
    }

    return contactInfo;
  }

  async updateContactInfo(identifier: string, type: 'person' | 'organisation', contactInfo: ContactInfo): Promise<void> {
    const filterField = type === 'person'
      ? 'partijIdentificator__codeSoortObjectId=bsn'
      : 'partijIdentificator__codeSoortObjectId=kvk';

    const url = `${this.config.baseUrl}/klantinteracties/api/v1/partijen?${filterField}&partijIdentificator__objectId=${identifier}`;

    const data: PartijResponse = await this.config.apiclient.getData(url);

    if (!data?.results || data.results.length === 0) {
      throw Error('No partij found for identifier');
    }

    const partij = data.results[0];
    const digitaleAdressen: DigitaalAdres[] = [];

    if (contactInfo.email) {
      digitaleAdressen.push({ adres: contactInfo.email, soortDigitaalAdres: 'email' });
    }
    if (contactInfo.phonenumber) {
      digitaleAdressen.push({ adres: contactInfo.phonenumber, soortDigitaalAdres: 'telefoonnummer' });
    }

    const updateUrl = `${this.config.baseUrl}/klantinteracties/api/v1/partijen/${partij.uuid}`;
    await this.config.apiclient.postData(updateUrl, { digitaleAdressen }, { 'Content-Type': 'application/json' });
  }
}
