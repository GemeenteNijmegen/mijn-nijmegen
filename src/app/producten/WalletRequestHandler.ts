import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';
import { Arc } from './Arc';
import * as walletTemplate from './templates/wallet.mustache';

interface walletEventRequestParams {
  cookies: string;
  productId: string;
  type: 'request' | 'results';
  status?: boolean;
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
    return Response.redirect('/login');
  }

  async handleLoggedinRequest(session: Session, eventParams: walletEventRequestParams) {
    if (eventParams.type == 'request') {
      return this.handleWalletRequest(eventParams.productId, session);
    } else {
      return this.handleWalletResult(eventParams, session);
    }
  }

  /**
   * Call ARC and return the redirect
   * If an error occurs render the page
   *
   * TODO verify ownership of prodcut and give the user a state parameter for the round trip (CSRF protection)
   * @param productId
   * @param session
   * @returns
   */
  private async handleWalletRequest(productId: string, session: Session) {
    try {
      const url = await this.arc.getRedirectUrl(productId);
      if (!url) {
        throw new Error('No redirect url returned by ARC');
      }
      return Response.redirect(url, 302);
    } catch (error) {
      console.error('Failed wallet issue request', error);
      // Render page
      const data = this.renderData(session);
      data.error = {
        text: 'Het inladen van uw product in de wallet is misgegaan. Sorry.',
      };
      const html = await render(data, walletTemplate.default);
      return Response.html(html, 200, session.getCookie());
    }
  }

  /**
   * Render the page with a success or error message when the user returns from the ARC
   * @param eventParams
   * @param session
   * @returns
   */
  private async handleWalletResult(eventParams: walletEventRequestParams, session: Session) {
    // Render page
    const data = this.renderData(session);
    if (eventParams.status == true) {
      data.success = {
        text: 'Uw product is succesvol ingeladen in de wallet.',
      };
    } else {
      data.error = {
        text: 'Het inladen van uw product in de wallet is misgegaan. Sorry.',
      };
    }
    const html = await render(data, walletTemplate.default);
    return Response.html(html, 200, session.getCookie());
  }

  /**
   * Base render data for page
   * @param session
   * @returns
   */
  private renderData(session: Session): any {
    const navigation = new Navigation('person', {
      currentPath: '/producten',
      showProducten: process.env.SHOW_PRODUCTEN == 'True',
    });

    return {
      volledigenaam: session.getValue('username'),
      title: 'Mijn Producten',
      shownav: true,
      nav: navigation.items,
      error: undefined,
    };
  }
}
