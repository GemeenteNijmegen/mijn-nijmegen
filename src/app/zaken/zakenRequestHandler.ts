import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { environmentVariables } from '@gemeentenijmegen/utils';
import * as zaakRow from './templates/zaak-row.mustache';
import * as zaakTemplate from './templates/zaak.mustache';
import * as zakenListPartial from './templates/zaken-table.mustache';
import * as zakenTemplate from './templates/zaken.mustache';
import { User, UserFromSession } from './User';
import { ZaakFormatter } from './ZaakFormatter';
import { SingleZaak, singleZaakSchema, ZaakSummariesSchema } from './ZaakInterface';
import { eventParams } from './zaken.lambda';
import { ZakenAggregatorConnector } from './ZakenAggregatorConnector';
import { Spinner } from '../../shared/Icons';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';

export class ZakenRequestHandler {
  private dynamoDBClient: DynamoDBClient;
  private connector: ZakenAggregatorConnector;

  constructor(dynamoDBClient: DynamoDBClient) {
    this.dynamoDBClient = dynamoDBClient;
    const env = environmentVariables(['APIGATEWAY_BASEURL', 'APIGATEWAY_APIKEY']);
    this.connector = new ZakenAggregatorConnector({
      baseUrl: new URL(env.APIGATEWAY_BASEURL),
      apiKeySecretName: env.APIGATEWAY_APIKEY,
      timeout: 2000,
    });
  }

  async handleRequest(params: eventParams) {
    // do session stuff here
    let session = new Session(params.cookies, this.dynamoDBClient);
    await session.init();
    if (session.isLoggedIn() != true) {
      return Response.redirect('/login');
    }

    if (!params.zaak) {
      return this.list(session, params);
    }

    if (params.zaak && params.zaakConnectorId && !params.file) {
      return this.get(params.zaakConnectorId, params.zaak, session);
    }

    if (params.zaak && params.zaakConnectorId && params.file) {
      return this.download(params.zaakConnectorId, params.zaak, params.file, session);
    }
    return Response.error(400);
  }

  async list(session: Session, params: eventParams) {
    const user = UserFromSession(session);

    const endpoint = 'zaken';
    let zakenList;
    let timeout = false;
    try {
      if (params.xsrfToken) {
        this.connector.setTimeout(10000); // allow for more time from frontend
      } else {
        this.connector.setTimeout(2000);
      }
      const json = await this.connector.fetch(endpoint, user);
      const zaken = ZaakSummariesSchema.parse(json);
      zakenList = new ZaakFormatter().formatList(zaken);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        timeout = true;
      }
    }

    if (params.responseType == 'json') {
      return this.jsonResponse(session, zakenList, params.xsrfToken);
    } else {
      return this.htmlResponse(session, user, zakenList, timeout);
    }
  }

  async jsonResponse(session: Session, zaakSummaries: any, xsrfToken?: string ) {
    if (!xsrfToken || !this.validToken(session, xsrfToken)) {
      return Response.error(403);
    }
    const { openHtml, closedHtml } = await this.zakenListsHtml(zaakSummaries);
    return Response.json({
      elements: [openHtml, closedHtml],
    });
  }

  async htmlResponse(session: Session, user: User, zaakSummaries: any, timeout?: boolean) {
    const navigation = new Navigation(user.type, { showZaken: true, currentPath: '/zaken' });

    const { openHtml, closedHtml } = await this.zakenListsHtml(zaakSummaries);

    let data = {
      'volledigenaam': user.userName,
      'title': 'Mijn zaken',
      'shownav': true,
      'nav': navigation.items,
      'open-zaken': openHtml,
      'closed-zaken': closedHtml,
      timeout,
      'xsrf_token': session.getValue('xsrf_token'),
    };
      // render page
    const html = await render(data, zakenTemplate.default, {
      zaak: zaakRow.default,
      spinner: Spinner.default,
    });
    return Response.html(html, 200, session.getCookie());
  }

  private async zakenListsHtml(zaakSummaries: any) {
    let openHtml, closedHtml;
    if (zaakSummaries) {
      openHtml = await render({ zaken: zaakSummaries.open, id: 'open-zaken-list' }, zakenListPartial.default,
        {
          'zaak-row': zaakRow.default,
        });
      closedHtml = await render({ zaken: zaakSummaries.closed, id: 'closed-zaken-list' }, zakenListPartial.default,
        {
          'zaak-row': zaakRow.default,
        });
    }
    return { openHtml, closedHtml };
  }

  async get(zaakConnectorId: string, zaakId: string, session: Session) {
    const user = UserFromSession(session);
    let timeout = false;
    let formattedZaak;
    try {
      const zaak = await this.fetchGet(zaakId, zaakConnectorId, user);
      if (zaak) {
        formattedZaak = new ZaakFormatter().formatZaak(zaak);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        timeout = true;
      }
    }
    if (formattedZaak || timeout) {
      const navigation = new Navigation(user.type, { showZaken: true, currentPath: '/zaken' });
      let data = {
        volledigenaam: session.getValue('username'),
        title: (formattedZaak) ? `Zaak - ${formattedZaak.zaak_type}` : 'Zaak ophalen niet gelukt',
        shownav: true,
        nav: navigation.items,
        zaak: formattedZaak,
        timeout,
      };
      // render page
      const html = await render(data, zaakTemplate.default);
      return Response.html(html, 200, session.getCookie());
    } else {
      return Response.error(404);
    }
  }

  private async fetchGet(zaakId: string, zaakConnectorId: string, user: User) {
    const endpoint = `zaken/${zaakConnectorId}/${zaakId}`;
    try {
      const result = await this.connector.fetch(endpoint, user);
      const json = singleZaakSchema.parse(result);
      return json as SingleZaak;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  async download(zaakConnectorId: string, zaakId: string, file: string, session: Session) {
    const user = UserFromSession(session);

    const endpoint = `zaken/${zaakConnectorId}/${zaakId}/download/${file}`;
    const response = await this.connector.fetch(endpoint, user);

    if (response) {
      return Response.redirect(response.downloadUrl);
    } else {
      return Response.error(404);
    }
  }

  async validToken(session: Session, token: string) {
    const xsrf_token = session.getValue('xsrf_token');
    const invalid_xsrf_token = xsrf_token == undefined || xsrf_token !== token;
    if (invalid_xsrf_token) {
      console.warn('xsrf tokens do not match');
      return false;
    }
    return true;
  }
}


