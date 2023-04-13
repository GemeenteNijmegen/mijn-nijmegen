import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { OpenIDConnect } from './shared/OpenIDConnect';
import { render } from '../../shared/render';

export async function handleLoginRequest(cookies: string, dynamoDBClient: any):Promise<ApiGatewayV2Response> {
  let session = new Session(cookies, dynamoDBClient);
  await session.init();
  if (session.isLoggedIn() === true) {
    console.debug('redirect to home');
    return Response.redirect('/');
  }
  let OIDC = new OpenIDConnect();
  const state = OIDC.generateState();
  await session.createSession({
    loggedin: { BOOL: false },
    state: { S: state },
  });
  const authUrl = OIDC.getLoginUrl(state);

  const data = {
    title: 'Inloggen',
    authUrl: authUrl,
  };
  const html = await render(data, __dirname + '/templates/login.mustache', {
    header: `${__dirname}/shared/header.mustache`,
    footer: `${__dirname}/shared/footer.mustache`,
  });
  const newCookies = [session.getCookie()];
  return Response.html(html, 200, newCookies);
}
