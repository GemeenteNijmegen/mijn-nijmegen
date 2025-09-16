import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import * as validator from 'validator';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';
import { User, UserFromSession } from '../zaken/User';
import { IOpenKlantAPI } from './OpenKlantApi';
import { OpenKlantLogic } from './OpenKlantLogic';
import * as template from './templates/contactgegevens.mustache';
import * as editTemplate from './templates/edit-contactgegevens.mustache';

interface Config {
  readonly dynamoDBClient: DynamoDBClient;
  readonly openKlantApi: IOpenKlantAPI;
}

interface RequestParameters {
  cookies: string;
  method: string;
  email?: string;
  telefoonnummer?: string;
  voorkeur?: string;
  xsrf_token?: string;
  error?: string[];
  path?: string;
}

export class ContactgegevensRequestHandler {
  readonly config: Config;
  constructor(config: Config) {
    this.config = config;
  }

  async handleRequest(params: RequestParameters): Promise<ApiGatewayV2Response> {

    let session = new Session(params.cookies, this.config.dynamoDBClient);

    await session.init();
    if (session.isLoggedIn() !== true) {
      return Response.redirect('/login');
    }

    if (params.path?.endsWith('edit') && params.method == 'GET') {
      return this.handleLoggedinEditRequest(session);
    } else if (params.path?.endsWith('edit') && params.method == 'POST') {
      return this.handleLoggedinPostRequest(session, params);
    } else {
      return this.handleLoggedinOverviewRequest(session);
    }

  }

  /**
   * Renders the overview page showing the currently known contactgegevens
   * @param session
   * @returns
   */
  private async handleLoggedinOverviewRequest(session: Session): Promise<ApiGatewayV2Response> {
    const user = UserFromSession(session);
    const partij = await this.config.openKlantApi.getPartijWithDigitaleAdresen(user);
    if (partij) {
      console.debug('Found a partij with uuid:', partij.uuid);
    } else {
      console.log('Did not find a partij.');
    }
    const data = this.formatOpenKlantResponse(partij);
    const html = await this.renderOverviewPage(session, user, data.email, data.telefoonnummer, data.voorkeur);
    return Response.html(html, 200, session.getCookie());
  }


  /**
   * Renders the edit page (shows the prefilled form) with currently known contactgegevens
   * @param session
   * @returns
   */
  private async handleLoggedinEditRequest(session: Session): Promise<ApiGatewayV2Response> {
    const user = UserFromSession(session);
    try {
      const partij = await this.config.openKlantApi.getPartijWithDigitaleAdresen(user);
      if (partij) {
        console.debug('Found a partij with uuid:', partij.uuid);
      } else {
        console.log('Did not find a partij.');
      }
      const data = this.formatOpenKlantResponse(partij);
      const html = await this.renderEditPage(session, user, data.email, data.telefoonnummer, data.voorkeur);
      return Response.html(html, 200, session.getCookie());

    } catch (error) {
      console.error(error);
      const html = await this.renderEditPage(session, user, undefined, undefined, undefined);
      return Response.html(html, 200, session.getCookie());
    }
  }

  /**
   * Processes the post request and when succesful redirects to the contactgegevens page
   * @returns
   */
  private async handleLoggedinPostRequest(session: Session, params: RequestParameters): Promise<ApiGatewayV2Response> {

    // Do a xsrf_token check
    const xsrf = session.getValue('xsrf_token');
    if (xsrf !== params.xsrf_token) {
      console.debug('XSRF Token mismatch', xsrf, params.xsrf_token);
      throw Error('xsrf_token mismatch!');
    }

    const user = UserFromSession(session);

    // Do input validation & redirect on errors
    const errors: string[] = [];
    if (params.email && !validator.isEmail(params.email)) {
      errors.push('email');
    }
    if (params.telefoonnummer && !validator.isMobilePhone(params.telefoonnummer) && !OpenKlantLogic.isValidPhonenumber(params.telefoonnummer)) {
      errors.push('telefoonnummer');
    }

    if (!params.telefoonnummer && params.voorkeur == 'telefoon') {
      errors.push('voorkeurTelefoonlMaarGeenTelefoon');
    }

    if (!params.email && params.voorkeur == 'email') {
      errors.push('voorkeurEmailMaarGeenEmail');
    }

    if (errors.length != 0) {
      const html = await this.renderEditPage(session, user, params.email, params.telefoonnummer, params.voorkeur, errors);
      return Response.html(html, 200, session.getCookie());
    }

    const openKlantCaller = new OpenKlantLogic({
      openKlantApi: this.config.openKlantApi,
    });

    if (user.type == 'person') {
      await openKlantCaller.updateContactgegevensNatuurlijkPersoon(user, params.email, params.telefoonnummer, params.voorkeur);
    } else {
      throw Error('Beheren van contactgegevens voor een organisatie is nog niet geimplementeerd');
    }

    // Do a redirect so we load the actual stored data from open klant.
    return Response.redirect('/contactgegevens', 302, session.getCookie());
  }

  /**
   * Renders the edit page
   * @returns
   */
  async renderEditPage(
    session: Session,
    user: User,
    email?: string,
    telefoonnummer?: string,
    voorkeur?: string,
    errors?: string[],
    errorMessage?: string,
  ) {
    const navigation = new Navigation(user.type, {
      currentPath: '/contactgegevens',
      showContactgegevens: process.env.SHOW_CONTACTGEGEVENS == 'True',
    });

    const data = {
      title: 'Mijn contactgegevens bewerken',
      shownav: true,
      nav: navigation.items,
      volledigenaam: session.getValue('username'),
      xsrf_token: session.getValue('xsrf_token'),
      email: email,
      emailError: errors?.includes('email'),
      telefoonnummer: telefoonnummer,
      telefoonnummerError: errors?.includes('telefoonnummer'),
      voorkeurEmail: voorkeur == 'email',
      voorkeurTelefoon: voorkeur == 'telefoon',
      errorMessage: errorMessage,
      voorkeurTelefoonlMaarGeenTelefoon: errors?.includes('voorkeurTelefoonlMaarGeenTelefoon'),
      voorkeurEmailMaarGeenEmail: errors?.includes('voorkeurEmailMaarGeenEmail'),
    };

    const html = await render(data, editTemplate.default);
    return html;
  }

  /**
   * Renders the overview page
   * @param session
   * @param user
   * @param email
   * @param telefoonnummer
   * @param errorMessage
   * @returns
   */
  async renderOverviewPage(session: Session, user: User, email?: string, telefoonnummer?: string, voorkeur?: string, errorMessage?: string) {

    // Page render basics
    const navigation = new Navigation(user.type, {
      currentPath: '/contactgegevens',
      showContactgegevens: process.env.SHOW_CONTACTGEGEVENS == 'True',
    });

    const data = {
      nav: navigation.items,
      volledigenaam: session.getValue('username'),
      email: email,
      telefoonnummer: telefoonnummer,
      voorkeurEmail: voorkeur == 'email',
      voorkeurTelefoon: voorkeur == 'telefoon',
      errorMessage: errorMessage,
      title: 'Mijn contactgegevens',
      shownav: true,
    };
    const html = await render(data, template.default);
    return html;
  }

  private formatOpenKlantResponse(partij: any) {
    console.debug('Formattting data render', JSON.stringify(partij));
    const email = partij?._expand?.digitaleAdressen?.find((adres: any) => adres.soortDigitaalAdres == 'email');
    const telefoonnummer = partij?._expand?.digitaleAdressen?.find((adres: any) => adres.soortDigitaalAdres == 'telefoonnummer');

    let voorkeurString = undefined;
    const voorkeur = partij?.voorkeursDigitaalAdres?.uuid;
    if (voorkeur) {
      const emailIsVoorkeur = voorkeur == email?.uuid;
      const telefoonIsVoorkeur = voorkeur == telefoonnummer?.uuid;
      if (emailIsVoorkeur) {
        voorkeurString = 'email';
      } else if (telefoonIsVoorkeur) {
        voorkeurString = 'telefoon';
      }
    }


    const data = {
      email: email ? email.adres : undefined,
      telefoonnummer: telefoonnummer ? telefoonnummer.adres : undefined,
      voorkeur: voorkeurString,
    };
    return data;
  }

}
