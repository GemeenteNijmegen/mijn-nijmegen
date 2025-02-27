import { Bsn } from '@gemeentenijmegen/utils';
import { ApiClient } from './ApiClient';

interface Config {
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

export const LANDCODE_NEDERLAND = '6030';

export class HaalCentraalApi {

  constructor(private config: Config) { }

  async getName(bsn: Bsn) {
    const response = await this.request({
      endpoint: 'personen',
      type: 'RaadpleegMetBurgerservicenummer',
      burgerservicenummer: [bsn],
      fields: ['adressering'], // Use this over naam as this is the nicely formated version of the name
    });
    return response.adressering.aanschrijfwijze;
  }

  async getBrpData(bsn: Bsn, fields: Fields[]) {
    const response = await this.request({
      endpoint: 'personen',
      type: 'RaadpleegMetBurgerservicenummer',
      burgerservicenummer: [bsn],
      fields: fields,
    });
    return response;
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
    });

    // Check response
    if (!data?.personen || data.personen.length == 0) {
      throw Error('No results for BSN');
    }
    if (data.personen.length > 1) {
      throw Error('Multiple results for single BSN but got: ' + data?.personen?.length);
    }

    // Check overleden datum
    if (data.personen[0].overlijden?.datum) {
      throw new Error('Persoon lijkt overleden');
    }

    return data.personen[0];

  } catch(error: any) {
    console.error(error);
    throw Error('Haal Centraal request failed');
  }
}