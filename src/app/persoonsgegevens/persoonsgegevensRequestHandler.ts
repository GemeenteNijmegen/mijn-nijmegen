import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';

import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { Bsn } from '@gemeentenijmegen/utils';
import { Persoonsgegevens, PersoonsgegevensMapper } from './Persoonsgegevens';
import * as template from './templates/persoonsgegevens.mustache';
import { BrpApi } from '../../shared/BrpApi';
import { HaalCentraalApi } from '../../shared/HaalCentraalApi';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';

interface RenderData {
  volledigenaam: string;
  title: string;
  shownav: boolean;
  nav: any;
  persoonsgegevens?: Persoonsgegevens;
  error?: string;
}

interface Config {
  apiClient: ApiClient;
  dynamoDBClient: DynamoDBClient;
  showZaken?: boolean; // show the 'Mijn Zaken' menu

  /**
   * Provide a HaalCentraal API client when if
   * want to use HaalCentraal.
   * @default - the IRMA BRP API is used
   */
  haalCentraalApi?: HaalCentraalApi;
}

export class PersoonsgegevensRequestHandler {

  constructor(private config: Config) { }

  async handleRequest(cookies: string) {
    console.time('request');
    console.timeLog('request', 'start request');

    // Session initalization
    console.timeLog('request', 'start init');
    let session = new Session(cookies, this.config.dynamoDBClient);
    await session.init();
    console.timeLog('request', 'init session');

    // Handle request if loggedin
    if (session.isLoggedIn() == true) {
      const response = await this.handleLoggedinRequest(session);
      console.timeEnd('request');
      return response;
    }

    console.timeEnd('request');
    return Response.redirect('/login');
  }

  private async handleLoggedinRequest(session: Session) {

    // Get the users BSN - Companies can log in, but can't use this page.
    const userType = session.getValue('user_type');
    if (userType != 'person') {
      return Response.redirect('/');
    }
    const bsn = session.getValue('identifier');

    // Setup view
    const navigation = new Navigation(userType, {
      currentPath: '/persoonsgegevens',
      showContactgegevens: process.env.SHOW_CONTACTGEGEVENS == 'True',
    });
    const data: RenderData = {
      volledigenaam: session.getValue('username'),
      title: 'Mijn gegevens',
      shownav: true,
      nav: navigation.items,
      persoonsgegevens: undefined,
      error: undefined,
    };

    // Get BRP data from HaalCentraal BRP API or old IRMA BRP API
    try {
      if (this.config.haalCentraalApi) {
        console.timeLog('request', 'starting HAAL CENTRAAL BRP API call');
        const brpData = await this.config.haalCentraalApi.getBrpData(new Bsn(bsn), [
          'burgerservicenummer', 'naam', 'adressering', 'geslacht', 'nationaliteiten', 'geboorte', 'verblijfplaatsBinnenland',
        ]);
        data.persoonsgegevens = PersoonsgegevensMapper.fromHaalCentraal(brpData);
        console.timeLog('request', 'finished HAAL CENTRAAL BRP API call');
      } else {
        console.timeLog('request', 'starting IRMA BRP API call');
        const brpApi = new BrpApi(this.config.apiClient);
        const brpData = await brpApi.getBrpData(bsn);
        data.persoonsgegevens = PersoonsgegevensMapper.fromBrpApi(brpData.Persoon);
        console.timeLog('request', 'finished IRMA BRP API call');
      }
    } catch (error) {
      console.log(error);
      data.error = 'Het ophalen van uw persoonsgegevens is misgegaan.';
      data.persoonsgegevens = undefined;
    }

    // render page
    const html = await render(data, template.default);
    return Response.html(html, 200, session.getCookie());
  }
}
