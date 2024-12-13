import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { IOpenKlantAPI } from './OpenKlantApi';
import { OpenKlantLogic } from './OpenKlantLogic';
import * as template from './templates/contactgegevens.mustache';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';
import { UserFromSession } from '../zaken/User';
import * as validator from 'validator';

interface Config {
  readonly dynamoDBClient: DynamoDBClient;
  readonly openKlantApi: IOpenKlantAPI;
}

interface RequestParameters {
  cookies: string;
  method: string;
  email?: string;
  telefoonnummer?: string;
  xsrf_token?: string;
}

export class ContactgegevensRequestHandler {
  readonly config: Config;
  constructor(config: Config) {
    this.config = config;
  }

  async handleRequest(params: RequestParameters) : Promise<ApiGatewayV2Response> {
    let session = new Session(params.cookies, this.config.dynamoDBClient);
    await session.init();
    if (session.isLoggedIn() !== true) {
      return Response.redirect('/login');
    }

    if (params.method == 'POST') {
      const response = await this.handleLoggedinPostRequest(session, params);
      return response;
    } else {
      const response = await this.handleLoggedinRequest(session);
      return response;
    }

  }

  private async handleLoggedinPostRequest(session: Session, params: RequestParameters): Promise<ApiGatewayV2Response> {

    // Do a xsrf_token check
    const xsrf = session.getValue('xsrf_token');
    if (xsrf !== params.xsrf_token) {
      console.debug('XSRF Token mismatch', xsrf, params.xsrf_token);
      throw Error('xsrf_token mismatch!');
    }

    // Do input validation
    if(params.email && !validator.isEmail(params.email)){
      throw Error('Invalid email');
    }
    if(params.telefoonnummer && !validator.isMobilePhone(params.telefoonnummer)){
      throw Error('Invalid telefoonnummer');
    }

    const openKlantCaller = new OpenKlantLogic({
      openKlantApi: this.config.openKlantApi,
    });

    const user = UserFromSession(session);

    if (user.type == 'person') {
      await openKlantCaller.updateContactgegevensNatuurlijkPersoon(user, params.email, params.telefoonnummer);
    } else {
      throw Error('Beheren van contactgegevens voor een organisatie is nog niet geimplementeerd');
    }

    return Response.redirect('/contactgegevens', 302, session.getCookie());
  }

  private async handleLoggedinRequest(session: Session) : Promise<ApiGatewayV2Response> {

    const user = UserFromSession(session);

    const partij = await this.config.openKlantApi.getPartijWithDigitaleAdresen(user);

    let data: any = {};
    if (partij) {
      console.debug('Found a partij with uuid:', partij.uuid);
      data = this.formatOpenKlantResponse(partij);
    } else {
      console.log('Did not find a partij.');
    }

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
    console.debug('Formattting data render', JSON.stringify(partij));
    const email = partij?._expand?.digitaleAdressen?.find((adres: any) => adres.soortDigitaalAdres == 'email');
    const telefoonnummer = partij?._expand?.digitaleAdressen?.find((adres: any) => adres.soortDigitaalAdres == 'telefoonnummer');
    return {
      email: email ? email.adres : undefined,
      telefoonnummer: telefoonnummer ? telefoonnummer.adres : undefined,
    };
  }

}
