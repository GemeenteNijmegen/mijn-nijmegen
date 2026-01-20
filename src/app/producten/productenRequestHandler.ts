import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { InlineApiDefinition } from 'aws-cdk-lib/aws-apigateway';
import { productEventParams } from './producten.lambda';
import * as productTemplate from './templates/product.mustache';
import * as productenTemplate from './templates/producten.mustache';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';
import { User, UserFromSession } from '../zaken/User';
import { ZakenAggregatorConnector } from '../zaken/ZakenAggregatorConnector';

interface RenderData {
  volledigenaam: string;
  title: string;
  shownav: boolean;
  nav: any;
  error?: string;
  products?: any;
  product?: any;
  walletIsIngeladen?: any;
}

interface Config {
  //apiClient: ApiClient;
  dynamoDBClient: DynamoDBClient;

}

export class ProductenRequestHandler {

  logger = new Logger();

  private connector: ZakenAggregatorConnector;

  constructor(private config: Config) {
    const env = environmentVariables(['ZAKEN_APIGATEWAY_BASEURL', 'ZAKEN_APIGATEWAY_APIKEY']);
    this.connector = new ZakenAggregatorConnector({
      baseUrl: new URL(env.ZAKEN_APIGATEWAY_BASEURL),
      apiKeySecretName: env.ZAKEN_APIGATEWAY_APIKEY,
      timeout: 2000,
    });
  }

  async handleRequest(cookies: string, eventParams: productEventParams) {

    console.time('request');
    console.timeLog('request', 'start request');

    // Session initalization
    console.timeLog('request', 'start init');
    let session = new Session(cookies, this.config.dynamoDBClient);
    await session.init();
    console.timeLog('request', 'init session');

    // Handle request if loggedin
    if (session.isLoggedIn() == true) {
      const response = await this.handleLoggedinRequest(session, eventParams);
      console.timeEnd('request');
      return response;
    }

    console.timeEnd('request');
    return Response.redirect('/login');

  }
  async handleLoggedinRequest(session: Session, eventParams: productEventParams) {

    // Setup view
    const navigation = new Navigation('person', {
      currentPath: '/producten',
      showContactgegevens: process.env.SHOW_CONTACTGEGEVENS == 'True',
      showProducten: process.env.SHOW_PRODUCTEN== 'True',
    });
    const data: RenderData = {
      volledigenaam: session.getValue('username'),
      title: 'Mijn Producten',
      shownav: true,
      nav: navigation.items,
      error: undefined,
    };
    const user: User = UserFromSession(session);
    if (eventParams.productId) {
      // individual product page

      if (eventParams.inladenWallet) {
        // Ga redirecten
        // Geef url mee /product/${eventParams.productId}?is_ingeladen_wallet=true
      }


      // NU alleen de eerste, nog niet paginated
      const results = await this.connector.fetch(`/mijn-services-aggregator/PRODUCTEN/producten/api/v1/producten/${eventParams.productId}`, user);
      this.logger.info('temp product results', results);

      data.product = results;
      // render page
      const html = await render(data, productTemplate.default);
      return Response.html(html, 200, session.getCookie());
    } else {
    // NU alleen de eerste, nog niet paginated
      const results = await this.connector.fetch('/mijn-services-aggregator/PRODUCTEN/producten/api/v1/producten', user, new URLSearchParams({ eigenaren__bsn: user.identifier }));
      this.logger.info('temp producten results', results);
      data.products = results.results;

      // render page
      const html = await render(data, productenTemplate.default);
      return Response.html(html, 200, session.getCookie());
    }


  }
}
