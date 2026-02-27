import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { ArrowRight, Checkmark, Spinner } from '../../shared/Icons';
import { logger } from '../../shared/Logger';
import { Navigation } from '../../shared/Navigation';
import { render } from '../../shared/render';
import { UserFromSession } from '../../shared/User';
import * as takenListPartial from '../zaken/templates/taken.mustache';
import * as zaakRow from '../zaken/templates/zaak-row.mustache';
import * as zakenListPartial from '../zaken/templates/zaken-table.mustache';
import { ZaakFormatter } from '../zaken/ZaakFormatter';
import { TaakSummariesResponseSchema, TaakSummariesSchema, TaakSummary, ZaakSummariesResponseSchema } from '../zaken/ZaakInterface';
import { ZakenAggregatorConnector } from '../zaken/ZakenAggregatorConnector';
import { eventParams } from './home.lambda';
import * as homeTemplate from './templates/home.mustache';
import { Util } from './Util';


interface HomeRequestHandlerProps {
  /**
   * Show zaken in navigation
   */
  showTaken?: boolean;
}

export class HomeRequestHandler {
  private dynamoDBClient: DynamoDBClient;
  private props?: HomeRequestHandlerProps;
  private zakenConnector: ZakenAggregatorConnector;

  constructor(dynamoDBClient: DynamoDBClient, props?: HomeRequestHandlerProps) {
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
    let zaken, taken;
    let timeout = false;
    (params.responseType == 'json') ? this.zakenConnector.setTimeout(10000) : this.zakenConnector.setTimeout(1000);
    try {
      [zaken, taken] = await Promise.all([this.zakenList(session), this.takenList(session)]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        timeout = true;
      }
    }
    if (params.responseType == 'json') {
      if (timeout) {
        return Response.json({ error: 'Het ophalen van gegevens duurde te lang…' }, 408);
      } else {
        return Response.json({ elements: [zaken, taken] });
      }
    } else {
      const navigation = new Navigation(userType, {
        currentPath: '/',
        showProducten: process.env.SHOW_PRODUCTEN == 'True',
      });

      const showContactgegevensNotice = process.env.CONTACTGEGEVENS_LIVE == 'True' &&
        (!session.getValue('email') || !session.getValue('phonenumber'));

      const data = {
        title: 'overzicht',
        shownav: true,
        nav: navigation.items,
        volledigenaam: naam,
        zaken: zaken,
        has_zaken: zaken ? true : false,
        taken: taken,
        has_taken: taken ? true : false,
        xsrf_token: session.getValue('xsrf_token'),
        timeout,
        header_additions: '<link rel="stylesheet" href="/static/styles/zaak.css">',
        showContactgegevensNotice,
      };
      // render page
      const html = await render(data, homeTemplate.default,
        {
          'spinner': Spinner.default,
          'arrow-right': ArrowRight.default,
          'checkmark': Checkmark.default,
        },
      );

      return Response.html(html, 200, session.getCookie());
    }
  }

  private async takenList(session: Session) {
    if (!this.props?.showTaken) {
      return '';
    }
    const user = UserFromSession(session);

    const endpoint = 'taken';
    const json = await this.zakenConnector.fetch(endpoint, user);

    // Handle new style response from zaakaggregator
    if (json.results) {
      try {
        const taken = TaakSummariesResponseSchema.parse(json);
        const takenToRender = taken.results.filter(taak => {
          const isOpen = taak.is_open;
          const isRecentAfgerond = taak.is_afgerond && Util.isLessThanDaysAgo(taak.laatstBewerktOp);
          const isRecentVerwerkt = taak.is_verwerkt && Util.isLessThanDaysAgo(taak.laatstBewerktOp);
          return isOpen || isRecentAfgerond || isRecentVerwerkt;
        });
        return await this.takenListHtml(takenToRender, taken.incompleteResults);
      } catch (error) {
        logger.error('Failed parsing taken');
        throw (error);
      }
    }

    // Handle old style response from zaakaggregator
    const taken = TaakSummariesSchema.parse(json);
    return this.takenListHtml(taken.filter(taak => taak.is_open));
  }

  private async zakenList(session: Session) {
    const user = UserFromSession(session);

    const endpoint = 'zaken';
    const json = await this.zakenConnector.fetch(endpoint, user, new URLSearchParams({ maxResults: '5' }));

    const zaken = ZaakSummariesResponseSchema.parse(json);
    const zakenList = new ZaakFormatter().formatList(zaken.results);
    return this.zakenListsHtml(zakenList, zaken.incompleteResults);
  }

  private async zakenListsHtml(zaakSummaries: any, incompleteResults?: boolean) {
    if (zaakSummaries) {
      const html = await render({ zaken: zaakSummaries.open, id: 'open-zaken-list', incompleteResults }, zakenListPartial.default,
        {
          'zaak-row': zaakRow.default,
        });
      return html;
    }
    return false;
  }

  private async takenListHtml(taakSummaries: TaakSummary[], incompleteResults?: boolean) {
    if (taakSummaries) {
      const html = await render({ taken: taakSummaries, takenid: 'taken-list', incompleteResults }, takenListPartial.default);
      return html;
    }
    return false;
  }

}
