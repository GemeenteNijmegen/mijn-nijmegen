import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Bsn, AWS } from '@gemeentenijmegen/utils';

export class HaalCentraalApi {

  private endpoint: string;
  private client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
    if (!process.env.BRP_API_URL) {
      throw new Error('Could not initialize brp api as no endpoint parameter is provided in BRP_API_URL');
    }
    if (!process.env.BRP_API_KEY) {
      throw new Error('Could not initialize brp api as no key parameter is provided in BRP_API_KEY');
    }
    this.endpoint = process.env.BRP_API_URL;
  }

  /**
   * Bevraag de Haal Centraal BRP API
   * @param bsn the bsn to get data for
   * @returns the API response data of {error: ""}
   */
  async getBrpData(bsn: string) {
    try {
      const apiKey = await AWS.getSecret(process.env.BRP_API_KEY_ARN!);
      const aBsn = new Bsn(bsn);
      let data = await this.client.postData(this.endpoint,
        {
          type: 'RaadpleegMetBurgerservicenummer',
          fields: ['aNummer', 'adressering', 'burgerservicenummer', 'datumEersteInschrijvingGBA', 'datumInschrijvingInGemeente', 'europeesKiesrecht', 'geboorte', 'gemeenteVanInschrijving', 'geslacht', 'gezag', 'immigratie', 'indicatieCurateleRegister', 'indicatieGezagMinderjarige', 'kinderen', 'leeftijd', 'naam', 'nationaliteiten', 'ouders', 'overlijden', 'partners', 'uitsluitingKiesrecht', 'verblijfplaats', 'verblijfstitel', 'verblijfplaatsBinnenland', 'adresseringBinnenland'],
          burgerservicenummer: aBsn.bsn,
        },
        {
          'Content-type': 'application/json',
          'X-API-KEY': apiKey,
        });

      if (data?.Persoon?.overleden) {
        throw new Error('Persoon lijkt overleden');
      } else if (data?.Persoon) {
        return data;
      }
      throw new Error('Het ophalen van persoonsgegevens is misgegaan.');
    } catch (error: any) {
      console.error('BRP API:', error.message);
      return { error: error.message };
    }
  }
}