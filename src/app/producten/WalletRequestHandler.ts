import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { Arc } from './Arc';
import * as walletTemplate from './templates/wallet.mustache';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';

interface walletEventRequestParams {
  cookies: string;
  productId: string;
  type: 'request' | 'results';
  status?: 'success' | 'failed';
}

interface Config {
  //apiClient: ApiClient;
  dynamoDBClient: DynamoDBClient;
}

export class WalletRequestHandler {
  private arc;
  constructor(private config: Config) {
    const env = environmentVariables(['ARC_BASEURL', 'ARC_APIKEY_ARN']);
    this.arc = new Arc(env.ARC_BASEURL, env.ARC_APIKEY_ARN);
  }

  async handleRequest(eventParams: walletEventRequestParams) {
    // Session initalization
    let session = new Session(eventParams.cookies, this.config.dynamoDBClient);
    await session.init();

    // Handle request if loggedin
    if (session.isLoggedIn() == true) {
      const response = await this.handleLoggedinRequest(session, eventParams);
      console.timeEnd('request');
      return response;
    }
    return Response.error(403);
  }

  async handleLoggedinRequest(session: Session, eventParams: walletEventRequestParams) {
    if (eventParams.type == 'request') {
      const url = await this.arc.getRedirectUrl(eventParams.productId);
      return Response.redirect(url, 302);
    } else {
      // Setup view
      const navigation = new Navigation('person', {
        currentPath: '/producten',
        showContactgegevens: process.env.SHOW_CONTACTGEGEVENS == 'True',
        showProducten: process.env.SHOW_PRODUCTEN== 'True',
      });
      const data = {
        volledigenaam: session.getValue('username'),
        title: 'Mijn Producten',
        shownav: true,
        nav: navigation.items,
        error: undefined,
      } as any;

      if(eventParams.status == 'failed') {
        data.error = {
          text: 'Het inladen van uw product in de wallet is misgegaan. Sorry.'
        }
      }
      if(eventParams.status == 'success') {
        data.success = {
          text: 'Uw product is succesvol ingeladen in de wallet.'
        }
      }

      const html = await render(data, walletTemplate.default);
      return Response.html(html, 200, session.getCookie());
    }
  }
}
