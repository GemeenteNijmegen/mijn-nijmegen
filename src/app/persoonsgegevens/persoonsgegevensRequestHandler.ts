import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { Bsn } from '@gemeentenijmegen/utils';
import { Persoonsgegevens, PersoonsgegevensMapper } from './Persoonsgegevens';
import * as contactgegevensTemplate from './templates/contactgegevens.mustache';
import * as template from './templates/persoonsgegevens.mustache';
import { HaalCentraalApi } from '../../shared/HaalCentraalApi';
import { BreadCrumbs, Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';

interface RenderData {
  volledigenaam: string;
  title: string;
  shownav: boolean;
  nav: any;
  breadcrumbs: any;
  persoonsgegevens?: Persoonsgegevens;
  error?: string;
  showContactgegevens?: boolean;
}

interface Config {
  dynamoDBClient: DynamoDBClient;
  /**
   * Provide a HaalCentraal API client when if
   * want to use HaalCentraal.
   */
  haalCentraalApi: HaalCentraalApi;
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

    const breadcrumbs = this.setupBreadcrumbs();
    const data: RenderData = {
      volledigenaam: session.getValue('username'),
      title: 'Mijn gegevens',
      shownav: true,
      nav: navigation.items,
      breadcrumbs: breadcrumbs.items,
      persoonsgegevens: undefined,
      error: undefined,
      showContactgegevens: process.env.CONTACTGEGEVENS_LIVE == 'True',
    };

    // Get BRP data from HaalCentraal
    try {
      console.timeLog('request', 'starting HAAL CENTRAAL BRP API call');
      const brpData = await this.config.haalCentraalApi.getBrpData(new Bsn(bsn), [
        'burgerservicenummer', 'naam', 'adressering', 'geslacht', 'nationaliteiten', 'geboorte', 'verblijfplaatsBinnenland',
      ]);
      data.persoonsgegevens = PersoonsgegevensMapper.fromHaalCentraal(brpData);
      console.timeLog('request', 'finished HAAL CENTRAAL BRP API call');
    } catch (error) {
      console.log(error);
      data.error = 'Het ophalen van uw persoonsgegevens is misgegaan.';
      data.persoonsgegevens = undefined;
    }

    // render page
    const html = await render(data, template.default, {
      contactgegevens: contactgegevensTemplate.default,
    });
    return Response.html(html, 200, session.getCookie());
  }

  private setupBreadcrumbs() {
    const crumbs = [
      {
        title: 'Home',
        url: '/',
      }, {
        title: 'Mijn gegevens',
        url: '/persoonsgegevens',
      },
    ];
    return new BreadCrumbs(crumbs);
  }
}
