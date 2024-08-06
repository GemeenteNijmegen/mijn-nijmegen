import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { AWS } from '@gemeentenijmegen/utils';
import { z } from 'zod';
import * as zaakTemplate from './templates/zaak.mustache';
import * as zakenTemplate from './templates/zaken.mustache';
import { User, UserFromSession } from './User';
import { ZaakAggregator } from './ZaakAggregator';
import { ZaakSummary } from './ZaakConnector';
import { ZaakFormatter } from './ZaakFormatter';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';

export class ZakenRequestHandler {
  private zaakAggregator: ZaakAggregator;
  private dynamoDBClient: DynamoDBClient;
  private apikey?: string;
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
    let zaken: ZaakSummary[];
    if (process.env.APIGATEWAY_BASEURL && process.env.APIGATEWAY_APIKEY) {
      zaken = await this.fetchList(user);
    } else {
      zaken = await this.zaakAggregator.list(user);
    }

    const zaakSummaries = new ZaakFormatter().formatList(zaken);

    const navigation = new Navigation(user.type, { showZaken: true, currentPath: '/zaken' });
    let data = {
      volledigenaam: user.userName,
      title: 'Mijn zaken',
      shownav: true,
      nav: navigation.items,
      zaken: zaakSummaries,
    };
    // render page
    const html = await render(data, zakenTemplate.default);
    return Response.html(html, 200, session.getCookie());
  }

  private async fetchList(user: User) {
    if (!process.env.APIGATEWAY_BASEURL || !process.env.APIGATEWAY_APIKEY) {
      throw Error('not all required env variables are set');
    }
    this.apikey = await AWS.getSecret(process.env.APIGATEWAY_APIKEY);
    const response = await fetch(`${process.env.APIGATEWAY_BASEURL}zaken?` + new URLSearchParams({
      userType: user.type,
      userIdentifier: user.identifier,
    }).toString(), {
      method: 'GET',
      headers: {
        'x-api-key': this.apikey,
      },
    });
    return ZaakSummariesSchema.parse(await response.json());
  }

  async get(zaakConnectorId: string, zaakId: string, session: Session) {
    const user = UserFromSession(session);
    const zaak = await this.zaakAggregator.get(zaakId, zaakConnectorId, user);
    if (zaak) {
      const formattedZaak = new ZaakFormatter().formatZaak(zaak);

      const navigation = new Navigation(user.type, { showZaken: true, currentPath: '/zaken' });
      let data = {
        volledigenaam: session.getValue('username'),
        title: `Zaak - ${formattedZaak.zaak_type}`,
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

export const ZaakSummarySchema = z.object({
  identifier: z.string(),
  internal_id: z.string(),
  registratiedatum: z.coerce.date(),
  verwachtte_einddatum: z.coerce.date().optional(),
  uiterlijke_einddatum: z.coerce.date().optional(),
  einddatum: z.coerce.date().optional().nullable(),
  zaak_type: z.string(),
  status: z.string().nullable(),
  resultaat: z.string().optional().nullable(),
});

export const ZaakSummariesSchema = z.array(ZaakSummarySchema);
