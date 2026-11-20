import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { Bsn } from '@gemeentenijmegen/utils';


import { HaalCentraalApi } from '../../shared/HaalCentraalApi';
import { logger } from '../../shared/Logger';
import { OpenIDConnect, OpenIDConnectResult } from '../../shared/OpenIDConnect';
import { OpenKlantApi } from '../../shared/OpenKlantApi';
import { Organisation, Person, User } from '../../shared/User';
import { VerIdAuthenticator } from '../../shared/VerIdAuthenticator';

type AuthenticationMethod = 'yivi' | 'digid' | 'eherkenning';
const eHerkenningKvkNummerClaim = 'urn:etoegang:1.9:EntityConcernedID:KvKnr';
const eHerkenningCompanyNameClaim = 'urn:etoegang:1.11:attribute-represented:CompanyName';

export interface AuthRequestHandlerProps {
  cookies: string;
  fullUrl: URL;
  queryStringParamError?: string;

  dynamoDBClient: DynamoDBClient;
  OpenIdConnect: OpenIDConnect;

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

  /**
   * When set (the VerID feature flag is on), logins that were started with VerID can be finished.
   */
  verIdAuthenticator?: VerIdAuthenticator;

  /**
   * OpenKlant API for fetching contact information
   */
  openKlantApi?: OpenKlantApi;

  /**
   * Feature flag for contact information
   */
  contactgegevensLive?: boolean;
}

export class AuthRequestHandler {
  private config: AuthRequestHandlerProps;

  constructor(props: AuthRequestHandlerProps) {
    this.config = props;
  }

  async handleRequest() {

    // Handle errors and cancelation by IdP
    if (this.config.queryStringParamError) {
      logger.info('Login cancelled or rejected by the identity provider', { reason: this.config.queryStringParamError });
      return Response.redirect('/login');
    }

    // Initalize the session
    let session = new Session(this.config.cookies, this.config.dynamoDBClient);
    await session.init();
    if (session.sessionId === false) {
      // Expired cookie, back button or a bot: not an application error
      logger.warn('No session on the auth callback, back to login');
      return Response.redirect('/login');
    }

    // Start validation of the request
    const state = session.getValue('state');
    const provider = session.getValue('provider');
    try {
      logger.debug('Finishing login', { provider });
      let user;
      if (provider === 'verid') {
        user = await this.userFromVerIdLogin(state);
      } else {
        user = this.userFromAuthResult(await this.config.OpenIdConnect.authorize(this.config.fullUrl, state));
      }

      if (!user) {
        logger.warn('Login result has no usable user, back to login', { provider });
        return Response.redirect('/login');
      }

      // Startup the session
      try {
        const username = await user.getUserName();
        const sessionData: any = {
          loggedin: { BOOL: true },
          identifier: { S: user.identifier },
          bsn: { S: user.type == 'person' ? user.identifier : '' }, // TODO: remove when consuming pages (persoonsgegevens, uitkeringen, zaken) have been updated to use identifier
          user_type: { S: user.type },
          username: { S: username },
          xsrf_token: { S: this.config.OpenIdConnect.generateState() },
        };

        // Fetch contact information if feature flag is enabled
        if (this.config.contactgegevensLive && this.config.openKlantApi) { // TODO brp and contactinfo call should happen in parallel
          try {
            const contactInfo = await this.config.openKlantApi.getContactInfo(user.identifier, user.type);
            if (contactInfo.email) {
              sessionData.email = { S: contactInfo.email };
            }
            if (contactInfo.phonenumber) {
              sessionData.phonenumber = { S: contactInfo.phonenumber };
            }
          } catch (error) {
            logger.warn('Fetching contact info from OpenKlant failed, continuing without', { error });
          }
        }

        await session.createSession(sessionData);
      } catch (error: any) {
        logger.error('Creating the logged-in session failed', { provider, error });
        return Response.error(500);
      }

    } catch (error: any) {
      logger.error('Login failed', { provider, error });
      return Response.redirect('/login');
    }
    return Response.redirect('/', 302, [session.getCookie({ sameSite: 'lax' })]);
  }

  /**
   * Finish a login that was started with VerID (BSN only, persons)
   */
  private async userFromVerIdLogin(state: string | undefined): Promise<User> {
    if (!this.config.verIdAuthenticator) {
      throw Error('Login was started with VerID but VerID is not available');
    }
    const bsn = await this.config.verIdAuthenticator.finish(this.config.fullUrl, state);
    logger.info('auth succesful', { method: 'verid' });
    return new Person(bsn, { haalCentraal: this.config.haalCentraalApi });
  }

  private logAuthMethod(authResult: OpenIDConnectResult) {
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
    logger.debug('Yivi kvk claims', { hasKvkClaim: !!yiviKvkClaim, hasNameClaim: !!yiviNameClaim });
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
      logger.debug('Yivi claims', { hasBsnClaim: !!bsnClaim, hasKvkClaim: !!kvkClaim });
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
      return new Person(bsn, { haalCentraal: this.config.haalCentraalApi });
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
    logger.debug('Scopes', { scopes });
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
