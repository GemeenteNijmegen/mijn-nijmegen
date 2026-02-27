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
      const newPartij: Partij = await this.config.apiclient.postData(
        `${this.config.baseUrl}/klantinteracties/api/v1/partijen`,
        {
          soortPartij: type === 'person' ? 'persoon' : 'organisatie',
          indicatieActief: true,
          partijIdentificatie: {},
          partijIdentificatoren: [{ objectId: identifier, codeSoortObjectId }],
        },
        { 'Content-Type': 'application/json' },
      );
      partijUuid = newPartij.uuid;
    } else {
      const partij = data.results[0];
      partijUuid = partij.uuid;
      existingAdressen = partij._expand?.digitaleAdressen || [];
    }

    const emailAdres = existingAdressen.find(a => a.soortDigitaalAdres === 'email');
    const phoneAdres = existingAdressen.find(a => a.soortDigitaalAdres === 'telefoonnummer');

    if (contactInfo.email) {
      const payload = { adres: contactInfo.email, soortDigitaalAdres: 'email', verstrektDoorPartij: partijUuid };
      if (emailAdres) {
        await this.config.apiclient.postData(`${this.config.baseUrl}/klantinteracties/api/v1/digitaleadressen/${emailAdres.uuid}`, payload, { 'Content-Type': 'application/json' });
      } else {
        await this.config.apiclient.postData(`${this.config.baseUrl}/klantinteracties/api/v1/digitaleadressen`, payload, { 'Content-Type': 'application/json' });
      }
    }

    if (contactInfo.phonenumber) {
      const payload = { adres: contactInfo.phonenumber, soortDigitaalAdres: 'telefoonnummer', verstrektDoorPartij: partijUuid };
      if (phoneAdres) {
        await this.config.apiclient.postData(`${this.config.baseUrl}/klantinteracties/api/v1/digitaleadressen/${phoneAdres.uuid}`, payload, { 'Content-Type': 'application/json' });
      } else {
        await this.config.apiclient.postData(`${this.config.baseUrl}/klantinteracties/api/v1/digitaleadressen`, payload, { 'Content-Type': 'application/json' });
      }
    }
  }
}


/* AN EXAMPLE of the response that includes the expand parameter

{
    "count": 1,
    "next": null,
    "previous": null,
    "results": [
        {
            "uuid": "2e9e7c58-c7c1-4d78-9133-a27758a04046",
            "url": "https://mijn-services.accp.nijmegen.nl/open-klant/klantinteracties/api/v1/partijen/2e9e7c58-c7c1-4d78-9133-a27758a04046",
            "nummer": "0000000302",
            "interneNotitie": "",
            "betrokkenen": [],
            "categorieRelaties": [],
            "digitaleAdressen": [
                {
                    "uuid": "109e446d-8f3f-49c1-bbd4-36a70d388338",
                    "url": "https://mijn-services.accp.nijmegen.nl/open-klant/klantinteracties/api/v1/digitaleadressen/109e446d-8f3f-49c1-bbd4-36a70d388338"
                }
            ],
            "voorkeursDigitaalAdres": null,
            "vertegenwoordigden": [],
            "rekeningnummers": [],
            "voorkeursRekeningnummer": null,
            "partijIdentificatoren": [
                {
                    "uuid": "bf4ebdfc-8e72-4a51-bbd1-f695449d18a2",
                    "url": "https://mijn-services.accp.nijmegen.nl/open-klant/klantinteracties/api/v1/partij-identificatoren/bf4ebdfc-8e72-4a51-bbd1-f695449d18a2"
                }
            ],
            "soortPartij": "persoon",
            "indicatieGeheimhouding": null,
            "voorkeurstaal": "",
            "indicatieActief": true,
            "bezoekadres": {
                "nummeraanduidingId": "",
                "adresregel1": "",
                "adresregel2": "",
                "adresregel3": "",
                "land": ""
            },
            "correspondentieadres": {
                "nummeraanduidingId": "",
                "adresregel1": "",
                "adresregel2": "",
                "adresregel3": "",
                "land": ""
            },
            "partijIdentificatie": {
                "contactnaam": {
                    "voorletters": "N",
                    "voornaam": "Nassier",
                    "voorvoegselAchternaam": "",
                    "achternaam": "Boedhoe"
                },
                "volledigeNaam": "Nassier Boedhoe"
            },
            "_expand": {
                "digitaleAdressen": [
                    {
                        "uuid": "109e446d-8f3f-49c1-bbd4-36a70d388338",
                        "url": "https://mijn-services.accp.nijmegen.nl/open-klant/klantinteracties/api/v1/digitaleadressen/109e446d-8f3f-49c1-bbd4-36a70d388338",
                        "verstrektDoorBetrokkene": null,
                        "verstrektDoorPartij": {
                            "uuid": "2e9e7c58-c7c1-4d78-9133-a27758a04046",
                            "url": "https://mijn-services.accp.nijmegen.nl/open-klant/klantinteracties/api/v1/partijen/2e9e7c58-c7c1-4d78-9133-a27758a04046"
                        },
                        "adres": "test@example.com",
                        "soortDigitaalAdres": "email",
                        "isStandaardAdres": false,
                        "omschrijving": ""
                    }
                ]
            }
        }
    ]
}

 */