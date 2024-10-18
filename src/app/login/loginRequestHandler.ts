import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import * as loginTemplate from './templates/login.mustache';
import { OpenIDConnect } from '../../shared/OpenIDConnect';
import { OpenIDConnectV2 } from '../../shared/OpenIDConnectV2';
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

  /**
   * Feature flag for NL Wallet (VerID)
   */
  useNlWalletVerId?: boolean;

  /**
   * Feature flag for NL Wallet (Signicat)
   */
  useNlWalletSignicat?: boolean;
}

export interface RequestParams {
  cookies?: string;
  nlwallet: boolean;
  method?: string;
}

interface AuthMethod {
  methodName: string;
  methodNiceName: string;
}

export class LoginRequestHandler {

  private config: LoginRequestHandlerProps;

  // OIDC configuration
  private oidc: OpenIDConnect;
  private oidcNlWalletSignicat?: OpenIDConnectV2;
  private oidcNlWalletVerId?: OpenIDConnectV2;

  constructor(props: LoginRequestHandlerProps) {
    this.config = props;
    this.oidc = new OpenIDConnect();

    if (props.useNlWalletVerId) {
      this.oidcNlWalletVerId = new OpenIDConnectV2({
        clientId: process.env.NL_WALLET_VERID_CLIENT_ID!,
        clientSecretArn: process.env.NL_WALLET_VERID_CLIENT_SECRET_ARN!,
        wellknown: process.env.NL_WALLET_VERID_WELL_KNOWN!,
        redirectUrl: process.env.APPLICATION_URL_BASE + 'auth',
      });
    }
    if (props.useNlWalletSignicat) {
      this.oidcNlWalletSignicat = new OpenIDConnectV2({
        clientId: process.env.NL_WALLET_SIGNICAT_CLIENT_ID!,
        clientSecretArn: process.env.NL_WALLET_SIGNICAT_CLIENT_SECRET_ARN!,
        wellknown: process.env.NL_WALLET_SIGNICAT_WELL_KNOWN!,
        redirectUrl: process.env.APPLICATION_URL_BASE + 'auth',
      });
    }
  }

  async handleRequest(params: RequestParams, dynamoDBClient: DynamoDBClient):Promise<ApiGatewayV2Response> {
    let session = new Session(params.cookies!, dynamoDBClient);
    await session.init();
    if (session.isLoggedIn() === true) {
      console.debug('redirect to home');
      return Response.redirect('/');
    }

    if (params.method) {
      return this.setupAuthenticationRedirect(session, params.method);
    }

    const authMethods = this.addAuthMethods(params.nlwallet);

    const data = {
      title: 'Inloggen',
      authMethods,
    };

    let template = loginTemplate.default;
    const html = await render(data, template);
    return Response.html(html);
  }

  private addAuthMethods(nlwallet: boolean): AuthMethod[] {
    const authMethods = [];
    if (this.config?.digidScope) {
      authMethods.push(this.authMethodData('digid', 'DigiD'));
    }
    if (this.config?.yiviScope) {
      authMethods.push(this.authMethodData('yivi', 'Yivi'));
    }
    if (this.config?.eHerkenningScope) {
      authMethods.push(this.authMethodData('eherkenning', 'eHerkenning'));
    }
    if (nlwallet && this.config.useNlWalletSignicat) {
      authMethods.push(this.authMethodData('nl-wallet-signicat', 'NL Wallet (Signicat)'));
    }
    if (nlwallet && this.config.useNlWalletVerId) {
      authMethods.push(this.authMethodData('nl-wallet-verid', 'NL Wallet (VerID)'));
    }
    return authMethods;
  }

  private authMethodData(name:string, niceName:string) {
    return {
      methodName: name,
      methodNiceName: niceName,
    };
  }

  private async setupAuthenticationRedirect(session: Session, method: string) {
    const supportedMethod = this.addAuthMethods(true).find(known => known.methodName == method);
    if (!supportedMethod) {
      throw Error('Authentication method is not suported!');
    }

    const baseOidcScope = this.config.oidcScope;

    const state = this.oidc.generateState();
    await session.createSession({
      loggedin: { BOOL: false },
      state: { S: state },
      method: { S: method },
    });

    let loginUrl = undefined;
    switch (method) {
      case 'yivi':
        const yiviScope = [baseOidcScope, this.config.yiviScope];
        if (this.config?.useYiviKvk) { // Feature flag
          yiviScope.push(this.config.yiviCondisconScope ?? '');
        } else {
          yiviScope.push(this.config.yiviBsnAttribute ?? '');
        }
        loginUrl = this.oidc.getLoginUrl(state, yiviScope.join(' '));
        break;
      case 'digid':
        loginUrl = this.oidc.getLoginUrl(state, `${baseOidcScope} ${this.config.digidScope}`);
        break;
      case 'eherkenning':
        loginUrl = this.oidc.getLoginUrl(state, `${baseOidcScope} ${this.config.eHerkenningScope}`);
        break;
      case 'nl-wallet-signicat':
        if (!this.oidcNlWalletSignicat) {
          throw Error('Nl Wallet Signicat auth method used but not configured!');
        }
        loginUrl = await this.oidcNlWalletSignicat.getLoginUrl(state, `${baseOidcScope} ${process.env.NL_WALLET_SIGNICAT_SCOPE}`);
        break;
      case 'nl-wallet-verid':
        if (!this.oidcNlWalletVerId) {
          throw Error('Nl Wallet VerID auth method used but not configured!');
        }
        loginUrl = await this.oidcNlWalletVerId.getLoginUrl(state, process.env.NL_WALLET_VERID_SCOPE!);
        break;
    }

    if (!loginUrl) {
      throw Error('Unsupported auth method.');
    }

    return Response.redirect(loginUrl, 302, session.getCookie());

  }

}
