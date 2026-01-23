import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { Bsn } from '@gemeentenijmegen/utils';


import { HaalCentraalApi } from '../../shared/HaalCentraalApi';
import { OpenIDConnectResult, OpenIDConnectV2 } from '../../shared/OpenIDConnectV2';
import { Organisation, Person, User } from '../../shared/User';

type AuthenticationMethod = 'yivi' | 'digid' | 'eherkenning';
const eHerkenningKvkNummerClaim = 'urn:etoegang:1.9:EntityConcernedID:KvKnr';
const eHerkenningCompanyNameClaim = 'urn:etoegang:1.11:attribute-represented:CompanyName';

export interface AuthRequestHandlerProps {
  cookies: string;
  fullUrl: URL;
  queryStringParamError?: string;

  dynamoDBClient: DynamoDBClient;
  apiClient: ApiClient;
  OpenIdConnect: OpenIDConnectV2;

  // Scopes
  yiviScope: string;
  digidScope: string;
  eherkenningScope: string;

  // Yivi attributes
  yiviBsnAttribute: string;
  yiviKvkNumberAttribute: string;
  yiviKvkNameAttribute: string;

  // Feature toggle
  useYiviKvk?: boolean;

  /**
   * If a haal centraal API is provided prefere this over the
   * old IRMA BRP API.
   */
  haalCentraalApi: HaalCentraalApi;
}

export class AuthRequestHandler {
  private config: AuthRequestHandlerProps;

  constructor(props: AuthRequestHandlerProps) {
    this.config = props;
  }

  async handleRequest() {

    // Handle errors and cancelation by IdP
    if (this.config.queryStringParamError) {
      console.log('Not starting authentication: ', this.config.queryStringParamError);
      return Response.redirect('/login');
    }

    // Initalize the session
    let session = new Session(this.config.cookies, this.config.dynamoDBClient);
    await session.init();
    if (session.sessionId === false) {
      return Response.redirect('/login');
    }

    // Start validation of the request
    const state = session.getValue('state');
    try {

      const result = await this.config.OpenIdConnect.authorize(this.config.fullUrl, state);

      console.log(result);
      const user = this.userFromAuthResult(result);
      console.log('user', user);


      if (!user) {
        return Response.redirect('/login');
      }

      // Startup the session
      try {
        const username = await user.getUserName();

        console.log(username);

        await session.createSession({
          loggedin: { BOOL: true },
          identifier: { S: user.identifier },
          bsn: { S: user.type == 'person' ? user.identifier : '' }, // TODO: remove when consuming pages (persoonsgegevens, uitkeringen, zaken) have been updated to use identifier
          user_type: { S: user.type },
          username: { S: username },
          xsrf_token: { S: this.config.OpenIdConnect.generateState() },
        });
      } catch (error: any) {
        console.error('creating session failed', error);
        return Response.error(500);
      }

    } catch (error: any) {
      console.error(error.message);
      return Response.redirect('/login');
    }
    return Response.redirect('/', 302, [session.getCookie()]);
  }

  private logAuthMethod(authResult: OpenIDConnectResult) {
    const logger = new Logger({ serviceName: 'mijnnijmegen' });
    if (authResult.claims.hasOwnProperty('acr') && authResult.claims.hasOwnProperty('amr')) {
      logger.info('auth succesful', { loa: authResult.claims.acr, method: authResult.claims.amr });
    }
  }


  /**
   * Get the BSN from the claims for a DigiD login
   * @param claims
   * @returns
   */
  bsnFromDigidLogin(authResult: OpenIDConnectResult): Bsn {
    const subject = 'sub';
    if (authResult.claims[subject]) {
      return new Bsn(authResult.claims[subject] as string);
    }
    throw Error('Invalid or no bsn in DigiD claims!');
  }

  /**
   * Get the BSN from a Yivi login
   * @param claims
   * @returns
   */
  bsnFromYiviLogin(authResult: OpenIDConnectResult): Bsn {
    const bsnAttribute = this.config.yiviBsnAttribute;
    console.log(this.config.yiviBsnAttribute, authResult.claims[bsnAttribute]);
    if (authResult.claims?.[bsnAttribute]) {
      return new Bsn(authResult.claims[bsnAttribute] as string);
    }
    throw Error('Invalid or no bsn in Yivi claims!');
  }

  /**
   * Get the KVK number and company name from a Yivi login
   * @param claims
   * @returns
   */
  kvkFromYiviLogin(authResult: OpenIDConnectResult): { kvkNumber: string; organisationName: string } {
    let kvkNumberAttribute = this.config.yiviKvkNumberAttribute;
    let kvkNameAttribute = this.config.yiviKvkNameAttribute;
    const yiviKvkClaim = authResult.claims[kvkNumberAttribute] as string;
    const yiviNameClaim = authResult.claims[kvkNameAttribute] as string;
    console.log(yiviKvkClaim, yiviNameClaim);
    if (yiviKvkClaim && yiviNameClaim && Number.isInteger(parseInt(yiviKvkClaim))) {
      return { kvkNumber: yiviKvkClaim, organisationName: yiviNameClaim };
    }
    throw Error('Invalid or no kvk in Yivi claims!');
  }

  /**
   * Get the KVK number and company name form a eHerkenning login
   * @param claims
   * @returns
   */
  kvkFromEherkenningLogin(authResult: OpenIDConnectResult): { kvkNumber: string; organisationName: string } {
    const kvkClaim = authResult.claims[eHerkenningKvkNummerClaim] as string;
    const organisationNameClaim = authResult.claims[eHerkenningCompanyNameClaim] as string;
    if (kvkClaim && Number.isInteger(parseInt(kvkClaim))) {
      return { kvkNumber: kvkClaim, organisationName: organisationNameClaim };
    }
    throw Error('Invalid eHerkenning login');
  }

  /**
   * Given the set of claims and scopes determine the login method and
   * authenticate the user based on the claims.
   * @param tokens
   * @returns User
   */
  userFromAuthResult(authResult: OpenIDConnectResult): User {
    const authMethod = this.authMethodFromScope(authResult.scopes);

    let bsn = undefined;
    let kvk = undefined;

    if (authMethod == 'yivi') {
      const bsnClaim = authResult.claims[this.config.yiviBsnAttribute];
      const kvkClaim = authResult.claims[this.config.yiviKvkNumberAttribute];
      if (bsnClaim) {
        bsn = this.bsnFromYiviLogin(authResult);
      }
      if (kvkClaim) {
        if (!this.config.useYiviKvk) { // Feature flag
          throw Error('Kvk login via Yivi is not enabled yet!');
        }
        kvk = this.kvkFromYiviLogin(authResult);
      }
    }

    if (authMethod == 'digid') {
      bsn = this.bsnFromDigidLogin(authResult);
    }

    if (authMethod == 'eherkenning') {
      kvk = this.kvkFromEherkenningLogin(authResult);
    }
    if (bsn || kvk) {
      this.logAuthMethod(authResult);
    }

    if (bsn) {
      return new Person(bsn, { apiClient: this.config.apiClient, haalCentraal: this.config.haalCentraalApi });
    }

    if (kvk) {
      return new Organisation(kvk.kvkNumber, kvk.organisationName);
    }

    throw Error('User authentication failed: No BSN or KVK found in request');
  }


  /**
   * Given a list of scopes issued by the IdP after authentication
   * determine the authentication method that is used
   * @param scope
   * @returns authentication method that is used
   */
  authMethodFromScope(scopes: string[]): AuthenticationMethod {
    console.log('Scopes', scopes);
    const fullScope = scopes.join(' ');
    if (fullScope.includes(this.config.yiviScope)) {
      return 'yivi';
    } else if (fullScope.includes(this.config.eherkenningScope)) {
      return 'eherkenning';
    } else if (fullScope.includes(this.config.digidScope)) {
      return 'digid';
    }
    throw Error('Unsupported authentication method');
  }

}
