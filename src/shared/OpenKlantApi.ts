import { ApiClient } from './ApiClient';

interface Config {
  readonly baseUrl: string;
  readonly apiclient: ApiClient;
}

interface DigitaalAdres {
  uuid: string;
  url: string;
  adres: string;
  soortDigitaalAdres: 'email' | 'telefoonnummer';
  verstrektDoorPartij: { uuid: string; url: string };
}

interface Partij {
  uuid: string;
  digitaleAdressen?: { uuid: string; url: string }[];
  _expand?: {
    digitaleAdressen?: DigitaalAdres[];
  };
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

    if (partij._expand?.digitaleAdressen) {
      for (const adres of partij._expand.digitaleAdressen) {
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
    const codeSoortObjectId = type === 'person' ? 'bsn' : 'kvk';

    const url = `${this.config.baseUrl}/klantinteracties/api/v1/partijen?${filterField}&partijIdentificator__objectId=${identifier}&expand=digitaleAdressen`;

    const data: PartijResponse = await this.config.apiclient.getData(url);

    let partijUuid: string;
    let existingAdressen: DigitaalAdres[] = [];

    if (!data?.results || data.results.length === 0) {
      const newPartij = await this.createNewPartij(type);
      await this.createPartijIdentificatie(identifier, codeSoortObjectId, newPartij.uuid);
      partijUuid = newPartij.uuid;
    } else {
      const partij = data.results[0];
      partijUuid = partij.uuid;
      existingAdressen = partij._expand?.digitaleAdressen || [];
    }

    const emailAdres = existingAdressen.find(a => a.soortDigitaalAdres === 'email');
    const phoneAdres = existingAdressen.find(a => a.soortDigitaalAdres === 'telefoonnummer');

    if (contactInfo.email) {
      const payload = {
        adres: contactInfo.email,
        soortDigitaalAdres: 'email',
        verstrektDoorPartij: { uuid: partijUuid },
        verstrektDoorBetrokkene: null,
        // isStandaardAdres: true, // TODO enable after open-klant upgrade
        // verificatieDatum: true, // TODO enable after open-klant upgrade
      };
      if (emailAdres) {
        await this.config.apiclient.putData(`${this.config.baseUrl}/klantinteracties/api/v1/digitaleadressen/${emailAdres.uuid}`, payload, { 'Content-Type': 'application/json' });
      } else {
        await this.config.apiclient.postData(`${this.config.baseUrl}/klantinteracties/api/v1/digitaleadressen`, payload, { 'Content-Type': 'application/json' });
      }
    }

    if (contactInfo.phonenumber) {
      const payload = {
        adres: contactInfo.phonenumber,
        soortDigitaalAdres: 'telefoonnummer',
        verstrektDoorPartij: { uuid: partijUuid },
        verstrektDoorBetrokkene: null,
        // isStandaardAdres: true, // TODO enable after open-klant upgrade
        // verificatieDatum: true, // TODO enable after open-klant upgrade
      };
      if (phoneAdres) {
        await this.config.apiclient.putData(`${this.config.baseUrl}/klantinteracties/api/v1/digitaleadressen/${phoneAdres.uuid}`, payload, { 'Content-Type': 'application/json' });
      } else {
        await this.config.apiclient.postData(`${this.config.baseUrl}/klantinteracties/api/v1/digitaleadressen`, payload, { 'Content-Type': 'application/json' });
      }
    }
  }

  private async createNewPartij(type: string) {
    const newPartij: Partij = await this.config.apiclient.postData(
      `${this.config.baseUrl}/klantinteracties/api/v1/partijen`,
      {
        soortPartij: type === 'person' ? 'persoon' : 'organisatie',
        indicatieActief: true,
        digitaleAdressen: [],
        voorkeursDigitaalAdres: null,
        rekeningnummers: [],
        voorkeursRekeningnummer: null,
        partijIdentificatie: {
          contactnaam: null,
        },
      },
      { 'Content-Type': 'application/json' },
    );
    return newPartij;
  }


  private async createPartijIdentificatie(identifier: string, codeSoortObjectId: string, partijUuid: string) {
    await this.config.apiclient.postData(
      `${this.config.baseUrl}/klantinteracties/api/v1/partij-identificatoren`,
      {
        identificeerdePartij: {
          uuid: partijUuid,
        },
        partijIdentificator: {
          objectId: identifier,
          codeSoortObjectId,
        },
      },
      { 'Content-Type': 'application/json' },
    );
  }
}
