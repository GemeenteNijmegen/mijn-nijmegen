import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import cookie from 'cookie';
import * as logoutTemplate from './templates/logout.mustache';
import { render } from '../../shared/render';
import * as surveyCTA from '../../shared/survey-cta.mustache';

export async function handleLogoutRequest(cookies: string, dynamoDBClient: DynamoDBClient) {
  let session = new Session(cookies, dynamoDBClient);
  if (await session.init()) {
    await session.updateSession({
      loggedin: { BOOL: false },
    });
  }

  const html = await render({ title: 'Uitgelogd' }, logoutTemplate.default, {
    surveyCTA: process.env.SHOW_SURVEY == 'true' ? surveyCTA.default : undefined,
  });
  const emptyCookie = cookie.serialize('session', '', {
    httpOnly: true,
    secure: true,
  });
  return Response.html(html, 200, [emptyCookie]);
}
