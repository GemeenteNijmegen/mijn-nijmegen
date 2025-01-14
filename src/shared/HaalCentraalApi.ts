import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Bsn } from '@gemeentenijmegen/utils';
import { IBrpApi } from './BrpApi';

export class HaalCentraalApi implements IBrpApi {

  private endpoint: string;
  private apiKey: string;
  private apiclient: ApiClient;

  constructor(apiclient: ApiClient, apiKey: string, endpoint: string) {
    this.endpoint = endpoint; //process.env.BRP_HAAL_CENTRAAL_API_URL;
    this.apiclient = apiclient;
    this.apiKey = apiKey;
  }

  async getNaam(bsn: string) {
    const persoon = await this.makeApiCall(bsn, ['naam']);
    if (persoon.error) {
      return persoon;
    }
    return persoon.naam.volledigeNaam;
  }

  async getBrpData(bsn: string) {
    return this.makeApiCall(bsn, [
      'naam',
      'aNummer',
      'adressering',
      'burgerservicenummer',
      'datumEersteInschrijvingGBA',
      'datumInschrijvingInGemeente',
      'europeesKiesrecht',
      'geboorte',
      'gemeenteVanInschrijving',
      'geslacht',
      'gezag',
      'immigratie',
      'indicatieCurateleRegister',
      'indicatieGezagMinderjarige',
      'kinderen',
      'leeftijd',
      'nationaliteiten',
      'ouders',
      'overlijden',
      'partners',
      'uitsluitingKiesrecht',
      'verblijfplaats',
      'verblijfstitel',
      'verblijfplaatsBinnenland',
      'adresseringBinnenland',
    ]);
  }

  /**
   * Bevraag de Haal Centraal BRP API
   * @param bsn the bsn to get data for
   * @returns the API response data of {error: ""}
   */
  private async makeApiCall(bsn: string, fields: string[]) {
    try {

      const aBsn = new Bsn(bsn);
      const body = JSON.stringify({
        type: 'RaadpleegMetBurgerservicenummer',
        fields: fields,
        burgerservicenummer: [aBsn.bsn],
      });

      const data = await this.apiclient.postData(this.endpoint, body, {
        'Content-type': 'application/json',
        'X-API-KEY': this.apiKey,
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

    } catch (error: any) {
      console.error('BRP API:', error.message);
      return { error: error.message };
    }
  }
}