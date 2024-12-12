import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import * as template from './templates/contactgegevens.mustache';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';
import { UserFromSession } from '../zaken/User';
import { IOpenKlantAPI } from './OpenKlantApi';

interface Config {
  dynamoDBClient: DynamoDBClient;
  openKlantApi: IOpenKlantAPI;
}

interface RequestParameters {
  cookies: string;
  method: string;
  email?: string;
  telefoonnummer?: string;
  xsrf_token?: string;
}

export class ContactgegevensRequestHandler {
  private config: Config;
  constructor(config: Config) {
    this.config = config;
  }

  async handleRequest(params: RequestParameters) {
    let session = new Session(params.cookies, this.config.dynamoDBClient);
    await session.init();
    if (session.isLoggedIn() !== true) {
      return Response.redirect('/login');
    }

    if (params.method == 'POST') {
      const response = await this.handleLoggedinPostRequest(session, params);
      console.timeEnd('request');
      return response;
    } else {
      const response = await this.handleLoggedinRequest(session);
      console.timeEnd('request');
      return response;
    }

  }

  private async handleLoggedinPostRequest(session: Session, params: RequestParameters) {

    // Do a xsrf_token check
    const xsrf = session.getValue('xsrf_token');
    if (xsrf !== params.xsrf_token) {
      throw Error('xsrf_token mismatch!');
    }

    const user = UserFromSession(session);
    const openKlantPartij = await this.config.openKlantApi.createNatuurlijkPersoon();
    await this.config.openKlantApi.addPartijIdentificatie(user, openKlantPartij.uuid);

    // if(params.email){
    //   const openKlantEmail = this.config.openKlantApi.addDigitaalAddress('email', params.email, openKlantPartij.uuid);
    // }

    // if(params.telefoonnummer) {
    //   const openKlantTelefoonnummer = this.config.openKlantApi.addDigitaalAddress('telefoonnummer', params.telefoonnummer, openKlantPartij.uuid);
    // }

  }

  private async handleLoggedinRequest(session: Session) {

    const user = UserFromSession(session);

    const partij = await this.config.openKlantApi.getPartijWithDigitaleAdresen(user);

    let data: any = this.formatOpenKlantResponse(partij);

    // Page render basics
    const navigation = new Navigation(user.type, { currentPath: '/contactgegevens' });
    data.nav = navigation.items;
    data.volledigenaam = session.getValue('username');
    data.xsrf_token = session.getValue('xsrf_token');
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
