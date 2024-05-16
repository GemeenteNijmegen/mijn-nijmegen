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
   * BSN attribbute for Yivi. Concatenated with `oidcScope`.
   */
  yiviBsnAttribute?: string;

  /**
   * Conditional disclosure scope for Yivi. Concatenated with `oidcScope`.
   */
  yiviCondisconScope?: string;

  /**
   * Scope param for eherkenning. Concatenated with `oidcScope`. Setting this implies eherkenning is active
   */
  eHerkenningScope?: string;

  /**
   * Feature flag to incicate if we need to enable conditional disclosure with kvk and bsn
   */
  useYiviKvk?: boolean;
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
    const authMethods = this.addAuthMethods(scope, state);

    const data = {
      title: 'Inloggen',
      authMethods,
    };

    let template = loginTemplate.default;

    const html = await render(data, template);
    const newCookies = [session.getCookie()];
    return Response.html(html, 200, newCookies);
  }

  private addAuthMethods(scope: string, state: string) {
    const authMethods = [];
    if (this.config?.digidScope) {
      const digidScope = `${scope} ${this.config.digidScope}`;
      authMethods.push(this.authMethodData(digidScope, state, 'digid', 'DigiD'));
    }
    if (this.config?.yiviScope) {
      const yiviScopes = [scope, this.config.yiviScope];
      if (this.config?.useYiviKvk) { // Feature flag
        yiviScopes.push(this.config.yiviCondisconScope ?? '');
      } else {
        yiviScopes.push(this.config.yiviBsnAttribute ?? '');
      }
      authMethods.push(this.authMethodData(yiviScopes.join(' '), state, 'yivi', 'Yivi'));

    }
    if (this.config?.eHerkenningScope) {
      const eherkenningScope = `${scope} ${this.config.eHerkenningScope}`;
      authMethods.push(this.authMethodData(eherkenningScope, state, 'eherkenning', 'eHerkenning'));
    }
    return authMethods;
  }

  private authMethodData(scope: string, state:string, name:string, niceName:string) {
    return {
      authUrl: this.oidc.getLoginUrl(state, scope),
      methodName: name,
      methodNiceName: niceName,
    };
  }
}
