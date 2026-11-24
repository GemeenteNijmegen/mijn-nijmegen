import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  ApiGatewayV2Response,
  Response,
} from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import * as loginTemplate from './templates/login.mustache';
import { logger } from '../../shared/Logger';
import { OpenIDConnect } from '../../shared/OpenIDConnect';
import { render } from '../../shared/render';
import { VerIdAuthenticator } from '../../shared/VerIdAuthenticator';

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

  /**
   * Feature flag to indicate if we need to enable the gemachtigde functionality
   */
  useGemachtigd?: boolean;

  /**
   * Feature flag for Yivi via Signicat. When false the Yivi login option is hidden
   * and `method=yivi` is rejected. Undefined means enabled.
   */
  useYiviSignicatEnabled?: boolean;

  /**
   * When set (the VerID feature flag is on), the Yivi button logs in via VerID instead of Signicat
   */
  verIdAuthenticator?: VerIdAuthenticator;

  /**
   * OpenIDConnect client
   */
  oidc: OpenIDConnect;
}

export interface RequestParams {
  cookies?: string;
  method?: string;
}

interface AuthMethod {
  methodName: string;
  methodNiceName: string;
}

interface AuthMethodGroup {
  groupName: string;
  authMethods: AuthMethod[];
}

export class LoginRequestHandler {
  private config: LoginRequestHandlerProps;

  constructor(props: LoginRequestHandlerProps) {
    this.config = props;
  }

  async handleRequest(
    params: RequestParams,
    dynamoDBClient: DynamoDBClient,
  ): Promise<ApiGatewayV2Response> {
    let session = new Session(params.cookies!, dynamoDBClient);
    await session.init();
    if (session.isLoggedIn() === true) {
      logger.debug('Already logged in, redirect to home');
      return Response.redirect('/');
    }

    if (params.method) {
      return this.setupAuthenticationRedirect(session, params.method);
    }

    const data = {
      title: 'Inloggen',
      authMethodGroups: this.authMethodGroups(),
    };

    let template = loginTemplate.default;
    const html = await render(data, template);
    return Response.html(html);
  }

  private yiviEnabled() {
    return !!this.config.verIdAuthenticator || (!!this.config.yiviScope && this.config.useYiviSignicatEnabled !== false);
  }

  private addAuthMethods(): AuthMethod[] {
    const authMethods = [];
    if (this.config?.digidScope) {
      authMethods.push(this.authMethodData('digid', 'DigiD'));
    }
    if (this.yiviEnabled()) {
      authMethods.push(this.authMethodData('yivi', 'Yivi'));
    }
    if (this.config?.eHerkenningScope) {
      authMethods.push(this.authMethodData('eherkenning', 'eHerkenning'));
    }
    if (this.config?.useGemachtigd) {
      authMethods.push(this.authMethodData('walletGemachtigd', 'ID Wallet'));
      authMethods.push(this.authMethodData('digidMachtigen', 'DigiD machtigen'));
    }
    return authMethods;
  }

  /**
   * Splits the configured auth methods into audience columns for the login page:
   * one for logging in as yourself (DigiD, Yivi, eHerkenning), one for logging in on behalf of
   * someone else (to be implemented). Groups without any configured method are omitted.
   *
   * Later can be extended for fieldlab experiment for gemachtigde.
   */
  private authMethodGroups(): AuthMethodGroup[] {
    const methods = this.addAuthMethods();
    const methodsNamed = (names: string[]) =>
      methods.filter((method) => names.includes(method.methodName));
    const groups: AuthMethodGroup[] = [];
    const selfMethodNames = ['digid', 'yivi', 'eherkenning'];

    if (this.config?.useGemachtigd) {
      groups.push(
        { groupName: 'Voor mezelf', authMethods: methodsNamed(selfMethodNames) },
        { groupName: 'Namens iemand anders', authMethods: methodsNamed(['walletGemachtigd', 'digidMachtigen']) },
      );
    } else {
      groups.push({
        groupName: '', // No name for now
        authMethods: methodsNamed(selfMethodNames),
      });
    }

    return groups.filter((group) => group.authMethods.length > 0);
  }

  private authMethodData(name: string, niceName: string) {
    return {
      methodName: name,
      methodNiceName: niceName,
    };
  }

  private async setupAuthenticationRedirect(session: Session, method: string) {
    if (method === 'yivi' && !this.yiviEnabled()) {
      // Yivi was switched off while the user had the login page open: show the page again without it
      logger.warn('Yivi login requested but Yivi is disabled, back to login');
      return Response.redirect('/login');
    }

    const supportedMethod = this.addAuthMethods().find(
      (known) => known.methodName == method,
    );
    if (!supportedMethod) {
      throw Error('Authentication method is not suported!');
    }

    if (method === 'yivi' && this.config.verIdAuthenticator) {
      return this.setupVerIdRedirect(session, this.config.verIdAuthenticator);
    }

    const baseOidcScope = this.config.oidcScope;

    const state = this.config.oidc.generateState();
    await session.createSession({
      loggedin: { BOOL: false },
      state: { S: state },
      method: { S: method },
    });

    let loginUrl = undefined;
    switch (method) {
      case 'yivi':
        const yiviScope = [baseOidcScope, this.config.yiviScope];
        if (this.config?.useYiviKvk) {
          // Feature flag
          yiviScope.push(this.config.yiviCondisconScope ?? '');
        } else {
          yiviScope.push(this.config.yiviBsnAttribute ?? '');
        }
        loginUrl = await this.config.oidc.getLoginUrl(
          state,
          yiviScope.join(' '),
        );
        break;
      case 'digid':
        loginUrl = await this.config.oidc.getLoginUrl(
          state,
          `${baseOidcScope} ${this.config.digidScope}`,
        );
        break;
      case 'eherkenning':
        loginUrl = await this.config.oidc.getLoginUrl(
          state,
          `${baseOidcScope} ${this.config.eHerkenningScope}`,
        );
        break;
      case 'walletGemachtigd':
        loginUrl = '/gemachtigd/login?method=IDWallet';
        break;
    }

    if (!loginUrl) {
      throw Error('Unsupported auth method.');
    }

    return Response.redirect(loginUrl.toString(), 302, session.getCookie({ sameSite: 'lax' }));
  }

  /**
   * Yivi via VerID: VerID generates the state itself (the PKCE verifier is stored under it).
   * If VerID cannot start a login, show the service unavailable error page: the other methods are not affected.
   */
  private async setupVerIdRedirect(session: Session, verId: VerIdAuthenticator) {
    let login;
    try {
      login = await verId.start();
    } catch (error) {
      logger.error('Starting a VerID login failed', { error });
      return Response.error(503);
    }
    await session.createSession({
      loggedin: { BOOL: false },
      state: { S: login.state },
      method: { S: 'yivi' },
      // The callback follows the provider that started the login, not its own configuration
      provider: { S: 'verid' },
    });
    return Response.redirect(login.url, 302, session.getCookie({ sameSite: 'lax' }));
  }
}
