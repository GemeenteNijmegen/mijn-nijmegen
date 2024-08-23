import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { AWS, environmentVariables } from '@gemeentenijmegen/utils';
import { z } from 'zod';
import * as zaakTemplate from './templates/zaak.mustache';
import * as zakenTemplate from './templates/zaken.mustache';
import { User, UserFromSession } from './User';
import { ZaakFormatter } from './ZaakFormatter';
import { SingleZaak } from './ZaakInterface';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';

export class ZakenRequestHandler {
  private dynamoDBClient: DynamoDBClient;
  private apiKey?: string;
  private zakenApiUrl: string;
  private zakenApiKeyName: string;

  constructor(dynamoDBClient: DynamoDBClient) {
    this.dynamoDBClient = dynamoDBClient;
    const env = environmentVariables(['APIGATEWAY_BASEURL', 'APIGATEWAY_APIKEY']);
    this.zakenApiUrl = env.APIGATEWAY_BASEURL;
    this.zakenApiKeyName = env.APIGATEWAY_APIKEY;
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
    const json = await this.fetch(endpoint, user);
    const zaken = ZaakSummariesSchema.parse(json);
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

  async get(zaakConnectorId: string, zaakId: string, session: Session) {
    const user = UserFromSession(session);
    const zaak = await this.fetchGet(zaakId, zaakConnectorId, user);

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

  private async fetchGet(zaakId: string, zaakConnectorId: string, user: User) {
    const endpoint = `zaken/${zaakConnectorId}/${zaakId}`;
    const json = await this.fetch(endpoint, user);
    json.registratiedatum = new Date(json.registratiedatum);
    json.verwachtte_einddatum = new Date(json.verwachtte_einddatum);
    json.uiterlijke_einddatum = new Date(json.uiterlijke_einddatum);
    json.einddatum = json.einddatum ? new Date(json.einddatum) : undefined;
    return json as SingleZaak;
  }

  async download(zaakConnectorId: string, zaakId: string, file: string, session: Session) {
    const user = UserFromSession(session);

    const endpoint = `zaken/${zaakConnectorId}/${zaakId}/download/${file}`;
    const response = await this.fetch(endpoint, user);

    if (response) {
      return Response.redirect(response.downloadUrl);
    } else {
      return Response.error(404);
    }
  }

  private async fetch(endPoint: string, user: User) {
    const key = await this.getApiKey();
    const userParams = new URLSearchParams({
      userType: user.type,
      userIdentifier: user.identifier,
    }).toString();
    const response = await fetch(`${this.zakenApiUrl}${endPoint}?${userParams}`, {
      method: 'GET',
      headers: {
        'x-api-key': key,
      },
    });
    const json = await response.json() as any;
    return json;
  }

  private async getApiKey(): Promise<string> {
    if (!this.apiKey) {
      this.apiKey = await AWS.getSecret(this.zakenApiKeyName);
      if (!this.apiKey) {
        throw Error('No API key found');
      }
    }
    return this.apiKey;
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
