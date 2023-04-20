import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import * as loginYiviTemplate from './templates/login-yivi.mustache';
import * as loginTemplate from './templates/login.mustache';
import { OpenIDConnect } from '../../shared/OpenIDConnect';
import { render } from '../../shared/render';

interface LoginRequestHandlerProps {
  useYivi?: boolean;
  digidServiceLevel?: DigidServiceLevel;
}

export enum DigidServiceLevel {
  DigiD_Laag = 'DigiD_Laag',
  DigiD_Midden = 'DigiD_Midden',
  DigiD_Hoog = 'DigiD_Hoog',
}

export class LoginRequestHandler {
  private useYivi: boolean = false;
  private digidServiceLevel?: DigidServiceLevel;
  constructor(props?: LoginRequestHandlerProps) {
    this.useYivi = props?.useYivi ?? false;
    this.digidServiceLevel = props?.digidServiceLevel;

  }

  async handleRequest(cookies: string, dynamoDBClient: DynamoDBClient):Promise<ApiGatewayV2Response> {
    let session = new Session(cookies, dynamoDBClient);
    await session.init();
    if (session.isLoggedIn() === true) {
      console.debug('redirect to home');
      return Response.redirect('/');
    }
    const scope = process.env.OIDC_SCOPE;
    let digidScope = `${scope} idp_scoping:digid`;
    if (this.digidServiceLevel) {
      digidScope = `${scope} service:${this.digidServiceLevel}`;
    }
    let OIDC = new OpenIDConnect();
    const state = OIDC.generateState();
    await session.createSession({
      loggedin: { BOOL: false },
      state: { S: state },
    });

    const authUrlDigid = OIDC.getLoginUrl(state, digidScope);

    const data = {
      title: 'Inloggen',
      authUrlDigid: authUrlDigid,
      authUrlYivi: '',
    };

    if (this.useYivi) {
      const yiviScope = `${scope} idp_scoping:yivi`;
      data.authUrlYivi = OIDC.getLoginUrl(state, yiviScope);
    }
    const template = this.useYivi ? loginYiviTemplate.default : loginTemplate.default;
    const html = await render(data, template);
    const newCookies = [session.getCookie()];
    return Response.html(html, 200, newCookies);
  }

}
