import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import * as homeTemplate from './templates/home.mustache';
import { MdiFileMultiple } from '../../shared/Icons';
import { nav } from '../../shared/nav';
import { render } from '../../shared/render';


interface HomeRequestHandlerProps {
  /**
   * Show zaken in navigation
   */
  showZaken?: boolean;
}

export async function homeRequestHandler(cookies: string, dynamoDBClient: DynamoDBClient, props?: HomeRequestHandlerProps) {
  let session = new Session(cookies, dynamoDBClient);
  await session.init();
  if (session.isLoggedIn() == true) {
    return handleLoggedinRequest(session, props);
  }
  return Response.redirect('/login');
}

async function handleLoggedinRequest(session: Session, props?: HomeRequestHandlerProps) {
  const zakenNav = {
    url: '/zaken',
    title: 'Zaken',
    description: 'Bekijk de status van uw zaken en aanvragen.',
    label: 'Bekijk zaken',
    icon: MdiFileMultiple.default,
  };
  if (props?.showZaken) {
    nav.push(zakenNav);
  }
  const naam = session.getValue('username') ?? 'Onbekende gebruiker';
  const data = {
    title: 'overzicht',
    shownav: true,
    nav: nav,
    volledigenaam: naam,
  };

  // render page
  const html = await render(data, homeTemplate.default);

  return Response.html(html, 200, session.getCookie());
}
