import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import * as homeTemplate from './templates/home.mustache';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';


interface HomeRequestHandlerProps {
  /**
   * Show zaken in navigation
   */
  showZaken?: boolean;
}

export class HomeRequestHandler {
  private dynamoDBClient: DynamoDBClient;
  private props: HomeRequestHandlerProps;
  constructor(dynamoDBClient: DynamoDBClient, props: HomeRequestHandlerProps) {
    this.dynamoDBClient = dynamoDBClient;
    this.props = props;
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
    const userType = session.getValue('user_type');
    const navigation = new Navigation(userType, { showZaken: this.props.showZaken, currentPath: '/' });
    const data = {
      title: 'overzicht',
      shownav: true,
      nav: navigation.items,
      volledigenaam: naam,
    };

    // render page
    const html = await render(data, homeTemplate.default);

    return Response.html(html, 200, session.getCookie());
  }
}
