import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  ApiGatewayV2Response,
  Response,
} from "@gemeentenijmegen/apigateway-http/lib/V2/Response";
import { Session } from "@gemeentenijmegen/session";
import { OpenIDConnect } from "../../shared/OpenIDConnect";
import { render } from "../../shared/render";
import * as loginTemplate from "./templates/login.mustache";

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
      console.debug("redirect to home");
      return Response.redirect("/");
    }

    if (params.method) {
      return this.setupAuthenticationRedirect(session, params.method);
    }

    const data = {
      title: "Inloggen",
      authMethodGroups: this.authMethodGroups(),
    };

    let template = loginTemplate.default;
    const html = await render(data, template);
    return Response.html(html);
  }

  private addAuthMethods(): AuthMethod[] {
    const authMethods = [];
    if (this.config?.digidScope) {
      authMethods.push(this.authMethodData("digid", "DigiD"));
    }
    if (this.config?.yiviScope) {
      authMethods.push(this.authMethodData("yivi", "Yivi"));
    }
    if (this.config?.eHerkenningScope) {
      authMethods.push(this.authMethodData("eherkenning", "eHerkenning"));
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
    const groups: AuthMethodGroup[] = [
      {
        groupName: "", // No name for now
        authMethods: methodsNamed(["digid", "yivi", "eherkenning"]),
      },
      // { groupName: 'Inloggen namens iemand anders', authMethods: methodsNamed([]) },
    ];
    return groups.filter((group) => group.authMethods.length > 0);
  }

  private authMethodData(name: string, niceName: string) {
    return {
      methodName: name,
      methodNiceName: niceName,
    };
  }

  private async setupAuthenticationRedirect(session: Session, method: string) {
    const supportedMethod = this.addAuthMethods().find(
      (known) => known.methodName == method,
    );
    if (!supportedMethod) {
      throw Error("Authentication method is not suported!");
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
      case "yivi":
        const yiviScope = [baseOidcScope, this.config.yiviScope];
        if (this.config?.useYiviKvk) {
          // Feature flag
          yiviScope.push(this.config.yiviCondisconScope ?? "");
        } else {
          yiviScope.push(this.config.yiviBsnAttribute ?? "");
        }
        loginUrl = await this.config.oidc.getLoginUrl(
          state,
          yiviScope.join(" "),
        );
        break;
      case "digid":
        loginUrl = await this.config.oidc.getLoginUrl(
          state,
          `${baseOidcScope} ${this.config.digidScope}`,
        );
        break;
      case "eherkenning":
        loginUrl = await this.config.oidc.getLoginUrl(
          state,
          `${baseOidcScope} ${this.config.eHerkenningScope}`,
        );
        break;
    }

    if (!loginUrl) {
      throw Error("Unsupported auth method.");
    }

    return Response.redirect(loginUrl.toString(), 302, session.getCookie());
  }
}
