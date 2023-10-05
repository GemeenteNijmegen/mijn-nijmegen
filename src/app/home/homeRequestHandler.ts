import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import * as homeTemplate from './templates/home.mustache';
import { MdiFileMultiple } from '../../shared/Icons';
import { nav } from '../../shared/nav';
import { render } from '../../shared/render';


interface HomeRequestHandlerProps {
  /**
   * Show zaken in navigation
   */
  showZaken?: boolean;
}

export class HomeRequestHandler {
  private dynamoDBClient: DynamoDBClient;
  constructor(dynamoDBClient: DynamoDBClient, props: HomeRequestHandlerProps) {
    this.dynamoDBClient = dynamoDBClient;
    const zakenNav = {
      url: '/zaken',
      title: 'Zaken',
      description: 'Bekijk de status van uw zaken en aanvragen.',
      label: 'Bekijk zaken',
      icon: MdiFileMultiple.default,
    };
    if (props?.showZaken) {
      nav.push(zakenNav);
    }
  }

  async handleRequest(cookies: string) {
    let session = new Session(cookies, this.dynamoDBClient);
    await session.init();
    if (session.isLoggedIn() == true) {
      return this.handleLoggedinRequest(session);
    }
    return Response.redirect('/login');
  }

  private async handleLoggedinRequest(session: Session) {

    const naam = session.getValue('username') ?? 'Onbekende gebruiker';
    const data = {
      title: 'overzicht',
      shownav: true,
      nav: nav,
      volledigenaam: naam,
    };

    // render page
    const html = await render(data, homeTemplate.default);

    return Response.html(html, 200, session.getCookie());
  }
}
