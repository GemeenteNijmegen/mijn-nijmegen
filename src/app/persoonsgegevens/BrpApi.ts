import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Bsn } from '@gemeentenijmegen/utils';

export class BrpApi {

  private endpoint: string;
  private client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
    if (!process.env.BRP_API_URL) {
      throw new Error('Could not initialize brp api as no endpoint parameter is provided in BRP_API_URL');
    }
    this.endpoint = process.env.BRP_API_URL;
  }

  /**
   * Bevraag de layer7 BRP API
   * @param bsn the bsn to get data for
   * @returns the API response data of {error: ""}
   */
  async getBrpData(bsn: string) {
    try {
      const aBsn = new Bsn(bsn);
      let data = await this.client.postData(this.endpoint, { bsn: aBsn.bsn }, { 'Content-type': 'application/json' });
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