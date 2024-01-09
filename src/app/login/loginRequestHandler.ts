import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
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
  digidScope?: string;

  /**
   * Scope param for Yivi. Concatenated with `oidcScope`. Setting this implies yivi is in active
   */
  yiviScope?: string;

  /**
   * Scope attribbutes for Yivi. Concatenated with `oidcScope`. Only active if yiviScope is set
   */
  yiviAttributes?: string;

  /**
   * Scope param for eherkenning. Concatenated with `oidcScope`. Setting this implies eherkenning is active
   */
  eHerkenningScope?: string;
}

export class LoginRequestHandler {
  private config: LoginRequestHandlerProps;
  private oidc: OpenIDConnect;
  constructor(props: LoginRequestHandlerProps) {
    this.config = props;
    this.oidc = new OpenIDConnect();
  }

  async handleRequest(cookies: string, dynamoDBClient: DynamoDBClient):Promise<ApiGatewayV2Response> {
    let session = new Session(cookies, dynamoDBClient);
    await session.init();
    if (session.isLoggedIn() === true) {
      console.debug('redirect to home');
      return Response.redirect('/');
    }
    const state = this.oidc.generateState();
    await session.createSession({
      loggedin: { BOOL: false },
      state: { S: state },
    });

    const scope = this.config.oidcScope;
    const authMethods = [];
    if (this.config?.digidScope) {
      const digidScope = `${scope} ${this.config.digidScope}`;
      authMethods.push(this.authMethodData(digidScope, state, 'digid', 'DigiD'));
    }
    if (this.config?.yiviScope) {
      const yiviScope = `${scope} ${this.config.yiviScope} ${this.config.yiviAttributes}`;
      authMethods.push(this.authMethodData(yiviScope, state, 'yivi', 'Yivi'));
    }

    const data = {
      title: 'Inloggen',
      authMethods,
    };

    let template = loginTemplate.default;

    const html = await render(data, template);
    const newCookies = [session.getCookie()];
    return Response.html(html, 200, newCookies);
  }

  private authMethodData(scope: string, state:string, name:string, niceName:string) {
    return {
      authUrl: this.oidc.getLoginUrl(state, scope),
      methodName: name,
      methodNiceName: niceName,
    };
  }
}
