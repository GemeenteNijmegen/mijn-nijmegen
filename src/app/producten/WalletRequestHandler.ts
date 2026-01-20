import { environmentVariables } from '@gemeentenijmegen/utils';
import { Arc } from './Arc';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Session } from '@gemeentenijmegen/session';
import { Navigation } from '../../shared/Navigation';
import { User, UserFromSession } from '../zaken/User';

interface walletEventRequestParams {
  cookies: string;
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

  async handleRequest(cookies: string, eventParams: walletEventRequestParams) {
    // Session initalization
    let session = new Session(cookies, this.config.dynamoDBClient);
    await session.init();

    // Handle request if loggedin
    if (session.isLoggedIn() == true) {
      const response = await this.handleLoggedinRequest(session, eventParams);
      console.timeEnd('request');
      return response;
    }
  }

  handleLoggedinRequest(session: Session, eventParams: walletEventRequestParams) {
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
    };
    const user: User = UserFromSession(session);
  }
}
