import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { eventParams } from './home.lambda';
import * as homeTemplate from './templates/home.mustache';
import { Spinner } from '../../shared/Icons';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';
import * as zaakRow from '../zaken/templates/zaak-row.mustache';
import * as zakenListPartial from '../zaken/templates/zaken-table.mustache';
import { UserFromSession } from '../zaken/User';
import { ZaakFormatter } from '../zaken/ZaakFormatter';
import { ZaakSummariesSchema } from '../zaken/ZaakInterface';
import { ZakenAggregatorConnector } from '../zaken/ZakenAggregatorConnector';


interface HomeRequestHandlerProps {
  /**
   * Show zaken in navigation
   */
  showZaken?: boolean;
}

export class HomeRequestHandler {
  private dynamoDBClient: DynamoDBClient;
  private props: HomeRequestHandlerProps;
  private zakenConnector: ZakenAggregatorConnector;

  constructor(dynamoDBClient: DynamoDBClient, props: HomeRequestHandlerProps) {
    this.dynamoDBClient = dynamoDBClient;
    this.props = props;

    const env = environmentVariables(['ZAKEN_APIGATEWAY_BASEURL', 'ZAKEN_APIGATEWAY_APIKEY']);
    this.zakenConnector = new ZakenAggregatorConnector({
      baseUrl: new URL(env.ZAKEN_APIGATEWAY_BASEURL),
      apiKeySecretName: env.ZAKEN_APIGATEWAY_APIKEY,
      timeout: 2000,
    });
  }

  async handleRequest(params: eventParams) {
    let session = new Session(params.cookies, this.dynamoDBClient);
    await session.init();
    if (session.isLoggedIn() == true) {
      return this.handleLoggedinRequest(session, params);
    }
    return Response.redirect('/login');
  }

  private async handleLoggedinRequest(session: Session, params: eventParams) {

    const naam = session.getValue('username') ?? 'Onbekende gebruiker';
    const userType = session.getValue('user_type');
    let zaken;
    let timeout = false;
    (params.responseType == 'json') ? this.zakenConnector.setTimeout(1000) : this.zakenConnector.setTimeout(10000);
    try {
      zaken = await this.zakenList(session);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        timeout = true;
      }
    }
    if (params.responseType == 'json') {
      return Response.json({ elements: [zaken] });
    } else {
      const navigation = new Navigation(userType, { showZaken: this.props.showZaken, currentPath: '/' });

      const data = {
        title: 'overzicht',
        shownav: true,
        nav: navigation.items,
        volledigenaam: naam,
        zaken: zaken,
        has_zaken: zaken ? true : false,
        xsrf_token: session.getValue('xsrf_token'),
        timeout,
      };
      // render page
      const html = await render(data, homeTemplate.default,
        { spinner: Spinner.default },
      );

      return Response.html(html, 200, session.getCookie());
    }
  }

  private async zakenList(session: Session) {
    const user = UserFromSession(session);

    const endpoint = 'zaken';
    const json = await this.zakenConnector.fetch(endpoint, user, new URLSearchParams({ maxResults: '5' }));
    const zaken = ZaakSummariesSchema.parse(json);
    const zakenList = new ZaakFormatter().formatList(zaken);
    return this.zakenListsHtml(zakenList);
  }

  private async zakenListsHtml(zaakSummaries: any) {
    if (zaakSummaries) {
      const html = await render({ zaken: zaakSummaries.open, id: 'open-zaken-list' }, zakenListPartial.default,
        {
          'zaak-row': zaakRow.default,
        });
      return html;
    }
    return false;
  }
}
