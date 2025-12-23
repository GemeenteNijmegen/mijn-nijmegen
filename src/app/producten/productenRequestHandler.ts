import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';
import * as template from './templates/producten.mustache?raw';

interface RenderData {
  volledigenaam: string;
  title: string;
  shownav: boolean;
  nav: any;
  error?: string;
}

interface Config {
  //apiClient: ApiClient;
  dynamoDBClient: DynamoDBClient;

}

export class ProductenRequestHandler {


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
  async handleLoggedinRequest(session: Session) {

    // Setup view
    const navigation = new Navigation('person', {
      currentPath: '/producten',
      showContactgegevens: process.env.SHOW_CONTACTGEGEVENS == 'True',
      showProducten: process.env.SHOW_PRODUCTEN == 'True',
    });
    const data: RenderData = {
      volledigenaam: session.getValue('username'),
      title: 'Mijn Producten',
      shownav: true,
      nav: navigation.items,
      error: undefined,
    };
    // render page
    const html = await render(data, template.default);
    return Response.html(html, 200, session.getCookie());
  }
}
