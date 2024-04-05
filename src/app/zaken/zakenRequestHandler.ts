import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import * as zaakTemplate from './templates/zaak.mustache';
import * as zakenTemplate from './templates/zaken.mustache';
import { UserFromSession } from './User';
import { ZaakAggregator } from './ZaakAggregator';
import { ZaakFormatter } from './ZaakFormatter';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';

export class ZakenRequestHandler {
  private zaakAggregator: ZaakAggregator;
  private dynamoDBClient: DynamoDBClient;
  constructor(zaakAggregator: ZaakAggregator, dynamoDBClient: DynamoDBClient) {
    this.zaakAggregator = zaakAggregator;
    this.dynamoDBClient = dynamoDBClient;
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
    console.timeLog('request', 'Api Client init');

    const zaken = await this.zaakAggregator.list(user);
    const zaakSummaries = new ZaakFormatter().formatList(zaken);

    const navigation = new Navigation(user.type, { showZaken: true, currentPath: '/zaken' });
    let data = {
      volledigenaam: user.userName,
      title: 'Lopende zaken',
      shownav: true,
      nav: navigation.items,
      zaken: zaakSummaries,
    };
    // render page
    const html = await render(data, zakenTemplate.default);
    return Response.html(html, 200, session.getCookie());
  }

  async get(zaakConnectorId: string, zaakId: string, session: Session) {
    const user = UserFromSession(session);
    const zaak = await this.zaakAggregator.get(zaakId, zaakConnectorId, user);
    if (zaak) {
      const formattedZaak = new ZaakFormatter().formatZaak(zaak);

      const navigation = new Navigation(user.type, { showZaken: true, currentPath: '/zaken' });
      let data = {
        volledigenaam: session.getValue('username'),
        title: 'Zaak',
        shownav: true,
        nav: navigation.items,
        zaak: formattedZaak,
      };
      // render page
      const html = await render(data, zaakTemplate.default);
      return Response.html(html, 200, session.getCookie());
    } else {
      return Response.error(404);
    }
  }

  async download(zaakConnectorId: string, zaakId: string, file: string, session: Session) {
    const user = UserFromSession(session);
    const response = await this.zaakAggregator.download(zaakConnectorId, zaakId, file, user);
    if (response) {
      return Response.redirect(response.downloadUrl);
    } else {
      return Response.error(404);
    }
  }
}

