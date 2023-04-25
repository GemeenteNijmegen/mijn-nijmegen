import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import * as loginYiviTemplate from './templates/login-yivi.mustache';
import * as loginTemplate from './templates/login.mustache';
import { OpenIDConnect } from '../../shared/OpenIDConnect';
import { render } from '../../shared/render';

interface LoginRequestHandlerProps {
  /**
   * General oidcScope. Will be concatenated with `digidScope` or `yiviScope`
   */
  oidcScope: string;

  /**
   * Scope param for digid. Concatenated with `oidcScope`
   */
  digidScope: string;

  /**
   * If set (and yiviScope is set) the yivi+digid template will be used and Yivi login is enabled
   */
  useYivi?: boolean;

  /**
   * Scope param for Yivi. Concatenated with `oidcScope`. Only active if `useYivi` is also set
   */
  yiviScope?: string;

  /**
   * Scope attribbutes for Yivi. Concatenated with `oidcScope`. Only active if `useYivi` is also set
   */
  yiviAttributes?: string;
}

export class LoginRequestHandler {
  private config: LoginRequestHandlerProps;
  constructor(props: LoginRequestHandlerProps) {
    this.config = props;
  }

  async handleRequest(cookies: string, dynamoDBClient: DynamoDBClient):Promise<ApiGatewayV2Response> {
    let session = new Session(cookies, dynamoDBClient);
    await session.init();
    if (session.isLoggedIn() === true) {
      console.debug('redirect to home');
      return Response.redirect('/');
    }
    const scope = this.config.oidcScope;
    let digidScope = `${scope} ${this.config.digidScope}`;
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

    // TODO: Simplify after yivi launch - JB 20230421
    let template = loginTemplate.default;
    if (this.config?.useYivi && this.config?.yiviScope) {
      const yiviScope = `${scope} ${this.config.yiviScope} ${this.config.yiviAttributes}`;
      data.authUrlYivi = OIDC.getLoginUrl(state, yiviScope);
      template = loginYiviTemplate.default;
    }

    const html = await render(data, template);
    const newCookies = [session.getCookie()];
    return Response.html(html, 200, newCookies);
  }
}
