import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import * as homeTemplate from './templates/home.mustache';
import { render } from '../../shared/render';

export async function homeRequestHandler(cookies: string, dynamoDBClient: DynamoDBClient) {
  let session = new Session(cookies, dynamoDBClient);
  await session.init();
  if (session.isLoggedIn() == true) {
    return handleLoggedinRequest(session);
  }
  return Response.redirect('/login');
}

async function handleLoggedinRequest(session: Session) {
  const naam = session.getValue('username') ?? 'Onbekende gebruiker';
  const data = {
    title: 'overzicht',
    shownav: true,
    volledigenaam: naam,
  };

  // render page
  const html = await render(data, homeTemplate.default);

  return Response.html(html, 200, session.getCookie());
}

