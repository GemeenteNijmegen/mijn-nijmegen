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
}

export class LoginRequestHandler {
  private config: LoginRequestHandlerProps;
  private oidc: OpenIDConnect;
  // private oidcNlWalletSignicat: OpenIDConnectV2;
  private oidcNlWalletVerId: OpenIDConnectV2;
  constructor(props: LoginRequestHandlerProps) {
    this.config = props;
    this.oidc = new OpenIDConnect();
    // this.oidcNlWalletSignicat = new OpenIDConnectV2({
    //   clientId: process.env.NL_WALLET_SIGNICAT_CLIENT_ID!,
    //   clientSecretArn: process.env.NL_WALLET_SIGNICAT_CLIENT_SECRET_ARN!,
    //   scope: process.env.NL_WALLET_SIGNICAT_SCOPE!,
    //   wellknown: process.env.NL_WALLET_SIGNICAT_WELL_KNOWN!,
    //   // applicationBaseUrl // loaded from env
    // });
    this.oidcNlWalletVerId = new OpenIDConnectV2({
      clientId: process.env.NL_WALLET_VERID_CLIENT_ID!,
      clientSecretArn: process.env.NL_WALLET_VERID_CLIENT_SECRET_ARN!,
      scope: process.env.NL_WALLET_VERID_SCOPE!,
      wellknown: process.env.NL_WALLET_VERID_WELL_KNOWN!,
      // applicationBaseUrl // loaded from env
    });
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
    // if (this.config?.nlWalletSignicatScope) {
    //   const nlWalletSignicatScope = `${scope} ${this.config.nlWalletSignicatScope}`;
    //   authMethods.push(this.authMethodDataNlWalletSignicat(nlWalletSignicatScope, state, 'nl-wallet-signicat', 'NL Wallet (Signicat)'));
    // }
    if (process.env.NL_WALLET_VERID_SCOPE) {
      const nlWalletVerIdScope = process.env.NL_WALLET_VERID_SCOPE;
      authMethods.push(this.authMethodDataNlWalletVerId(nlWalletVerIdScope, state, 'nl-wallet-verid', 'NL Wallet (VerID)'));
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

  // private authMethodDataNlWalletSignicat(scope: string, state: string, name: string, niceName: string) {
  //   const oidc = new OpenIDConnect(); // TODO setup for Signicat
  //   return {
  //     authUrl: oidc.getLoginUrl(state, scope),
  //     methodName: name,
  //     methodNiceName: niceName,
  //   };
  // }

  private authMethodDataNlWalletVerId(scope: string, state: string, name: string, niceName: string) {
    return {
      authUrl: this.oidcNlWalletVerId.getLoginUrl(state, scope),
      methodName: name,
      methodNiceName: niceName,
    };
  }

}
