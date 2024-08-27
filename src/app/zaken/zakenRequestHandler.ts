import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { environmentVariables } from '@gemeentenijmegen/utils';
import * as zaakTemplate from './templates/zaak.mustache';
import * as zakenTemplate from './templates/zaken.mustache';
import { User, UserFromSession } from './User';
import { ZaakFormatter } from './ZaakFormatter';
import { SingleZaak, singleZaakSchema, ZaakSummariesSchema } from './ZaakInterface';
import { ZakenAggregatorConnector } from './ZakenAggregatorConnector';
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

  async handleRequest(cookies: string, zaakConnectorId?: string, zaak?: string, file?: string ) {
    // do session stuff here
    let session = new Session(cookies, this.dynamoDBClient);
    await session.init();
    if (session.isLoggedIn() != true) {
      return Response.redirect('/login');
    }

    if (!zaak) {
      return this.list(session);
    }

    if (zaak && zaakConnectorId && !file) {
      return this.get(zaakConnectorId, zaak, session);
    }

    if (zaak && zaakConnectorId && file) {
      return this.download(zaakConnectorId, zaak, file, session);
    }
    return Response.error(400);
  }

  async list(session: Session) {
    const user = UserFromSession(session);

    const endpoint = 'zaken';
    let zaakSummaries;
    let timeout = false;
    try {
      const json = await this.connector.fetch(endpoint, user);
      const zaken = ZaakSummariesSchema.parse(json);
      zaakSummaries = new ZaakFormatter().formatList(zaken);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        timeout = true;
      }
    }

    const navigation = new Navigation(user.type, { showZaken: true, currentPath: '/zaken' });
    let data = {
      volledigenaam: user.userName,
      title: 'Mijn zaken',
      shownav: true,
      nav: navigation.items,
      zaken: zaakSummaries,
      timeout,
    };
    // render page
    const html = await render(data, zakenTemplate.default);
    return Response.html(html, 200, session.getCookie());
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
}


