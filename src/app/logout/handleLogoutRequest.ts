import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import cookie from 'cookie';
import * as logoutTemplate from './templates/logout.mustache';
import { render } from '../../shared/render';

export async function handleLogoutRequest(cookies: string, dynamoDBClient: DynamoDBClient) {
  let session = new Session(cookies, dynamoDBClient);
  if (await session.init()) {
    await session.updateSession({
      loggedin: { BOOL: false },
    });
  }

  const html = await render({ title: 'Uitgelogd' }, logoutTemplate.default, {
    header: `${__dirname}/shared/header.mustache`,
    footer: `${__dirname}/shared/footer.mustache`,
  });
  const emptyCookie = cookie.serialize('session', '', {
    httpOnly: true,
    secure: true,
  });
  return Response.html(html, 200, [emptyCookie]);
}
