import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Bsn } from '@gemeentenijmegen/utils';

interface Config {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly apiclient: ApiClient;
}

type Fields =
  'aNummer' |
  'adressering' |
  'burgerservicenummer' |
  'datumEersteInschrijvingGBA' |
  'datumInschrijvingInGemeente' |
  'europeesKiesrecht' |
  'geboorte' |
  'gemeenteVanInschrijving' |
  'geslacht' |
  'gezag' |
  'immigratie' |
  'indicatieCurateleRegister' |
  'indicatieGezagMinderjarige' |
  'kinderen' |
  'leeftijd' |
  'naam' |
  'nationaliteiten' |
  'ouders' |
  'overlijden' |
  'partners' |
  'uitsluitingKiesrecht' |
  'verblijfplaats.verblijfadres' |
  'verblijfstitel' |
  'verblijfplaatsBinnenland' |
  'adresseringBinnenland';

interface requestConfiguration {
  endpoint: 'personen';
  type: 'RaadpleegMetBurgerservicenummer';
  fields: Fields[];
  burgerservicenummer: Bsn[];
}

export class HaalCentraalApi {

  constructor(private config: Config) { }



  async getName(bsn: Bsn) {
    const response = await this.request({
      endpoint: 'personen',
      type: 'RaadpleegMetBurgerservicenummer',
      burgerservicenummer: [bsn],
      fields: ['naam'],
    });
    if (!response?.personen || response.personen.length > 1) {
      throw Error('Multiple results for single BSN');
    }
    return response.personen[0].naam.volledigeNaam;
  }

  async getBrpData(bsn: Bsn, fields: Fields[]) {
    const response = await this.request({
      endpoint: 'personen',
      type: 'RaadpleegMetBurgerservicenummer',
      burgerservicenummer: [bsn],
      fields: fields,
    });
    if (!response?.personen || response.personen.length > 1) {
      throw Error('Multiple results for single BSN');
    }
    return response.personen[0].naam.volledigeNaam;
  }

  async request(requestConfiguration: requestConfiguration): Promise<any> {
    const url = `${this.config.baseUrl}/${requestConfiguration.endpoint}`;
    const body = JSON.stringify({
      type: requestConfiguration.type,
      fields: requestConfiguration.fields,
      burgerservicenummer: requestConfiguration.burgerservicenummer.map(bsn => bsn.bsn),
    });
    const data = await this.config.apiclient.postData(url, body, {
      'Content-type': 'application/json',
      'X-API-KEY': this.config.apiKey,
    });
    if (data?.personen?.length != 1) {
      throw Error('Expected a response of exactly one persoon got: ' + data?.personen?.length);
    }
    const persoon = data.personen[0];

    // Check overleden datum
    if (persoon.overlijden?.datum) {
      throw new Error('Persoon lijkt overleden');
    }

    return persoon;

  } catch(error: any) {
    console.error(error);
    throw Error('Haal Centraal request failed');
  }
}