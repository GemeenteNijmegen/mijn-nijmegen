import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { eventParams } from './taken.lambda';
import { Spinner, ArrowRight } from '../../shared/Icons';
import { logger } from '../../shared/Logger';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';
import * as homeTemplate from '../home/templates/home.mustache';
import * as takenListPartial from '../zaken/templates/taken.mustache';
import { UserFromSession } from '../zaken/User';
import { TaakSummariesResponseSchema, TaakSummariesSchema, TaakSummary } from '../zaken/ZaakInterface';
import { ZakenAggregatorConnector } from '../zaken/ZakenAggregatorConnector';

export class TaakrequestHandler {
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

    if (!params.taakId) {
      return this.list(session, params);
    }
    return Response.error(400);
  }

  async list(session: Session, params: eventParams) {
    const user = UserFromSession(session);
    let timeout = false;
    let taken;
    (params.responseType == 'json') ? this.connector.setTimeout(10000) : this.connector.setTimeout(1000);
    try {
      taken = await this.takenList(session);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        timeout = true;
      }
    }
    if (params.responseType == 'json') {
      if (timeout) {
        return Response.json({ error: 'Het ophalen van gegevens duurde te lang…' }, 408);
      } else {
        return Response.json({ elements: [taken] });
      }
    } else {
      const navigation = new Navigation(user.type, {
        currentPath: '/',
        showContactgegevens: process.env.SHOW_CONTACTGEGEVENS == 'True',
      });

      const data = {
        title: 'overzicht',
        shownav: true,
        nav: navigation.items,
        volledigenaam: user.userName,
        taken,
        has_taken: taken ? true : false,
        xsrf_token: session.getValue('xsrf_token'),
        timeout,
      };
      // render page
      const html = await render(data, homeTemplate.default,
        {
          'spinner': Spinner.default,
          'arrow-right': ArrowRight.default,
        },
      );

      return Response.html(html, 200, session.getCookie());
    }
  }


  private async takenList(session: Session) {
    const user = UserFromSession(session);

    const endpoint = 'taken';
    const json = await this.connector.fetch(endpoint, user);

    // Handle new style response from zaakaggregator
    if (json.results) {
      try {
        const taken = TaakSummariesResponseSchema.parse(json);
        return await this.takenListHtml(taken.results.filter(taak => taak.is_open), taken.incompleteResults);
      } catch (error) {
        logger.error('Failed parsing taken');
        throw (error);
      }
    }

    // Handle old style response from zaakaggregator
    const taken = TaakSummariesSchema.parse(json);
    return this.takenListHtml(taken);
  }

  private async takenListHtml(taakSummaries: TaakSummary[], incompleteResults?: boolean) {
    if (taakSummaries) {
      const html = await render({ taken: taakSummaries, takenid: 'open-taken-list', incompleteResults }, takenListPartial.default);
      return html;
    }
    return false;
  }

}
