import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { OpenklantApi } from './OpenKlantApi';
import * as template from './templates/contactgegevens.mustache';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';
import { UserFromSession } from '../zaken/User';

interface Config {
  dynamoDBClient: DynamoDBClient;
}

export class ContactgegevensRequestHandler {
  private config: Config;
  constructor(config: Config) {
    this.config = config;
  }

  async handleRequest(cookies: string) {
    console.time('request');
    console.timeLog('request', 'start request');

    let session = new Session(cookies, this.config.dynamoDBClient);
    await session.init();
    console.timeLog('request', 'init session done');
    if (session.isLoggedIn() == true) {
      // Get API data
      const response = await this.handleLoggedinRequest(session);
      console.timeEnd('request');
      return response;
    }
    console.timeEnd('request');
    return Response.redirect('/login');
  }

  private async handleLoggedinRequest(session: Session) {

    const user = UserFromSession(session)

    const openklantApi = new OpenklantApi();
    console.time('get-partij');
    const partij = openklantApi.getPartijWithDigitaleAdresen(user);
    console.timeEnd('get-partij');

    const data: any = this.formatOpenKlantResponse(partij);

    // Page render basics
    const navigation = new Navigation(user.type, { currentPath: '/contactgegevens' });
    data.nav = navigation.items;
    data.volledigenaam = session.getValue('username');
    const html = await this.renderHtml(data);

    return Response.html(html, 200, session.getCookie());
  }

  async renderHtml(data: any) {
    data.title = 'Mijn contactgegevens';
    data.shownav = true;

    // render page
    const html = await render(data, template.default);
    return html;
  }

  private formatOpenKlantResponse(partij: any) {
    console.debug(JSON.stringify(partij));
    const email = partij?._expand?.digitaleAdressen?.find((adres: any) => adres.soortDigitaalAdres == 'email');
    const telefoonnummer = partij?._expand?.digitaleAdressen?.find((adres: any) => adres.soortDigitaalAdres == 'telefoonnummer');
    return {
      email: email ? email.adres : undefined,
      telefoonnummer: telefoonnummer ? telefoonnummer.adres : undefined,
    };
  }

}
