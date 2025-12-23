import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { Spinner } from '../../shared/Icons';
import { logger } from '../../shared/Logger';
import { BreadCrumbs, Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';
import { validateToken } from '../../shared/validateToken';
import * as singleZaakPartial from './templates/singlezaak.mustache?raw';
import * as takenTemplate from './templates/taken.mustache?raw';
import * as zaakRow from './templates/zaak-row.mustache?raw';
import * as zaakTemplate from './templates/zaak.mustache?raw';
import * as zakenListPartial from './templates/zaken-table.mustache?raw';
import * as zakenTemplate from './templates/zaken.mustache?raw';
import { User, UserFromSession } from './User';
import { ZaakFormatter } from './ZaakFormatter';
import { SingleZaak, singleZaakSchema, ZaakSummariesResponseSchema, ZaakSummariesSchema } from './ZaakInterface';
import { eventParams } from './zaken.lambda';
import { ZakenAggregatorConnector } from './ZakenAggregatorConnector';

export class ZakenRequestHandler {
  private dynamoDBClient: DynamoDBClient;
  private connector: ZakenAggregatorConnector;

  constructor(dynamoDBClient: DynamoDBClient) {
    this.dynamoDBClient = dynamoDBClient;
    const env = environmentVariables(['ZAKEN_APIGATEWAY_BASEURL', 'ZAKEN_APIGATEWAY_APIKEY']);
    this.connector = new ZakenAggregatorConnector({
      baseUrl: new URL(env.ZAKEN_APIGATEWAY_BASEURL),
      apiKeySecretName: env.ZAKEN_APIGATEWAY_APIKEY,
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

    if (!params.zaakId && !params.taakId) {
      return this.list(session, params);
    } else if (params.taakId && params.zaakConnectorId && params.file) {
      return this.downloadTaak(params.zaakConnectorId, params.taakId, params.file, session);
    } else if (params.zaakId && params.zaakConnectorId && params.file) {
      return this.download(params.zaakConnectorId, params.zaakId, params.file, session);
    } else if (params.zaakId && params.zaakConnectorId) {
      return this.get(params, session);
    }
    return Response.error(400);
  }

  async list(session: Session, params: eventParams) {
    const user = UserFromSession(session);

    const endpoint = 'zaken';
    let zakenList;
    let timeout = false;
    try {
      if (params.responseType == 'json') {
        this.connector.setTimeout(10000); // allow for more time from frontend
      } else {
        this.connector.setTimeout(2000);
      }
      const json = await this.connector.fetch(endpoint, user);

      // Handle new style response from zaakaggregator
      if (json.results) {
        const zaken = ZaakSummariesResponseSchema.parse(json);
        zakenList = new ZaakFormatter().formatList(zaken.results);
      } else { // Handle old style response from zaakaggregator
        const zaken = ZaakSummariesSchema.parse(json);
        zakenList = new ZaakFormatter().formatList(zaken);
      }

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        timeout = true;
      } else {
        logger.error('Failed to get zaken from zaakaggregator', { err });
      }
    }

    if (params.responseType == 'json') {
      if (timeout) {
        return Response.json({ error: 'Het ophalen van gegevens duurde te lang…' }, 408);
      } else {
        return this.jsonListResponse(session, zakenList, params.xsrfToken);
      }
    } else {
      return this.htmlListResponse(session, user, zakenList, timeout);
    }
  }

  async jsonListResponse(session: Session, zaakSummaries: any, xsrfToken?: string) {
    if (!xsrfToken || !validateToken(session, xsrfToken)) {
      return Response.error(403);
    }
    const { openHtml, closedHtml } = await this.zakenListsHtml(zaakSummaries);
    return Response.json({
      elements: [openHtml, closedHtml],
    });
  }

  async htmlListResponse(session: Session, user: User, zaakSummaries: any, timeout?: boolean) {
    const navigation = this.setupNavigation(user);
    const breadcrumbs = this.setupBreadcrumbs();

    const { openHtml, closedHtml } = await this.zakenListsHtml(zaakSummaries);

    let data = {
      'volledigenaam': user.userName,
      'title': 'Mijn zaken',
      'shownav': true,
      'nav': navigation.items,
      'breadcrumbs': breadcrumbs.items,
      'open-zaken': openHtml,
      'closed-zaken': closedHtml,
      timeout,
      'xsrf_token': session.getValue('xsrf_token'),
      'header_additions': '<link rel="stylesheet" href="/static/styles/zaak.css">',
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
      closedHtml = await render({ zaken: zaakSummaries.gesloten, id: 'closed-zaken-list' }, zakenListPartial.default,
        {
          'zaak-row': zaakRow.default,
        });
    }
    return { openHtml, closedHtml };
  }

  async get(params: eventParams, session: Session) {
    if (!params.zaakConnectorId || !params.zaakId) {
      throw Error('connector and zaakid need to be defined');
    }
    const user = UserFromSession(session);

    if (params.responseType == 'json') {
      this.connector.setTimeout(10000); // allow for more time from frontend
    } else {
      this.connector.setTimeout(2000);
    }

    let timeout = false;
    let formattedZaak;
    try {
      const zaak = await this.fetchGet(params.zaakId, params.zaakConnectorId, user);
      if (zaak) {
        formattedZaak = new ZaakFormatter().formatZaak(zaak);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        timeout = true;
      }
    }
    if (params.responseType == 'json') {
      if (timeout) {
        return Response.json({ error: 'Het ophalen van gegevens duurde te lang…' }, 408);
      } else {
        return this.jsonGetResponse(session, formattedZaak, params.xsrfToken);
      }
    } else {
      const path = `/zaken/${params.zaakConnectorId}/${params.zaakId}`;
      return this.htmlGetResponse(session, formattedZaak, path, timeout);
    }

  }

  private async htmlGetResponse(session: Session, formattedZaak: any, path: string, timeout: boolean) {
    const user = UserFromSession(session);
    //If we get neither a zaak or a timeout flag, the zaak doesn't exist or isn't accessible for the user.
    if (formattedZaak || timeout) {
      const navigation = this.setupNavigation(user);

      const breadcrumbs = this.setupBreadcrumbs(formattedZaak, path);

      let data = {
        volledigenaam: session.getValue('username'),
        title: (formattedZaak) ? `Zaak - ${formattedZaak.zaak_type}` : 'Zaak ophalen niet gelukt',
        shownav: true,
        nav: navigation.items,
        breadcrumbs: breadcrumbs.items,
        singlezaak: await this.zaakHtml(formattedZaak),
        timeout,
        xsrf_token: session.getValue('xsrf_token'),
        header_additions: '<link rel="stylesheet" href="/static/styles/zaak.css">',
      };
      console.debug(data);
      // render page
      const html = await render(data, zaakTemplate.default, {
        taken: takenTemplate.default,
        spinner: Spinner.default,
      });
      return Response.html(html, 200, session.getCookie());
    } else {
      return Response.error(404);
    }
  }

  private setupBreadcrumbs(formattedZaak?: any, path?: string) {
    const crumbs = [
      {
        title: 'Home',
        url: '/',
      }, {
        title: 'Mijn zaken',
        url: '/zaken',
      },
    ];
    if (formattedZaak && path) {
      crumbs.push(
        {
          title: formattedZaak?.zaak_type ?? 'Zaak',
          url: path,
        });
    }
    return new BreadCrumbs(crumbs);
  }

  private setupNavigation(user: User) {
    return new Navigation(user.type, {
      currentPath: '/zaken',
      showContactgegevens: process.env.SHOW_CONTACTGEGEVENS == 'True',
    });
  }

  private async jsonGetResponse(session: Session, formattedZaak: any, xsrfToken?: string) {
    if (!xsrfToken || !validateToken(session, xsrfToken)) {
      return Response.error(403);
    }
    const zaak = await this.zaakHtml(formattedZaak);
    return Response.json({
      elements: [zaak],
    });
  }

  private async zaakHtml(zaak: any) {
    return render({ zaak }, singleZaakPartial.default, {
      taken: takenTemplate.default,
    });
  }

  private async fetchGet(zaakId: string, zaakConnectorId: string, user: User) {
    const endpoint = `zaken/${zaakConnectorId}/${zaakId}`;
    const result = await this.connector.fetch(endpoint, user);
    const json = singleZaakSchema.parse(result);
    return json as SingleZaak;
  }

  async download(zaakConnectorId: string, zaakId: string, file: string, session: Session) {
    const user = UserFromSession(session);
    const endpoint = `zaken/${zaakConnectorId}/${zaakId}/download/${file}`;

    this.connector.setTimeout(10000);
    const result = await this.connector.fetch(endpoint, user);

    if (result) {
      if (result?.downloadUrl) {
        return Response.redirect(result.downloadUrl);
      } else {
        const response = result.response;
        //response is binary, return file
        logger.debug('fetch content-type octet-stream');
        const contentArrayBuffer = await response.arrayBuffer();
        logger.debug('response retrieved contentarraybuffer', contentArrayBuffer);
        return {
          statusCode: 200,
          body: Buffer.from(contentArrayBuffer).toString('base64'),
          headers: {
            'Content-type': 'application/octet-stream',
            'Content-Disposition': `attachment;filename=${result.filename}`,
          },
          isBase64Encoded: true,
        } as ApiGatewayV2Response;
      }
    } else {
      return Response.error(404);
    }
  }

  async downloadTaak(zaakConnectorId: string, taakId: string, file: string, session: Session) {
    const user = UserFromSession(session);

    const endpoint = `taken/${zaakConnectorId}/download/${taakId}/${file}`;
    const response = await this.connector.fetch(endpoint, user);

    if (response) {
      return Response.redirect(response.downloadUrl);
    } else {
      return Response.error(404);
    }
  }
}


