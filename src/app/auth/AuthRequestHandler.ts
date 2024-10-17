import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { Bsn } from '@gemeentenijmegen/utils';
import { IdTokenClaims, TokenSet } from 'openid-client';
import { AuthenticationService } from './AuthenticationService';
import { BrpApi } from './BrpApi';

import { HaalCentraalApi } from './HaalCentraalApi';
import { OpenIDConnect } from '../../shared/OpenIDConnect';
import { OpenIDConnectV2 } from '../../shared/OpenIDConnectV2';

type AuthenticationMethod = 'yivi' | 'digid' | 'eherkenning';
const eHerkenningKvkNummerClaim = 'urn:etoegang:1.9:EntityConcernedID:KvKnr';
const eHerkenningCompanyNameClaim = 'urn:etoegang:1.11:attribute-represented:CompanyName';

export interface AuthRequestHandlerProps {
  cookies: string;
  queryStringParamCode: string;
  queryStringParamState: string;
  dynamoDBClient: DynamoDBClient;
  apiClient: ApiClient;
  OpenIdConnect: OpenIDConnect;
  authenticationService?: AuthenticationService;

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
  useNlWalletVerId?: boolean;
  useNlWalletSignicat?: boolean;
}

export class AuthRequestHandler {
  private config: AuthRequestHandlerProps;

  private oidcNlWalletSignicat?: OpenIDConnectV2;
  private oidcNlWalletVerId?: OpenIDConnectV2;

  constructor(props: AuthRequestHandlerProps) {
    this.config = props;
    if (props.useNlWalletVerId) {
      this.oidcNlWalletVerId = new OpenIDConnectV2({
        clientId: process.env.NL_WALLET_VERID_CLIENT_ID!,
        clientSecretArn: process.env.NL_WALLET_VERID_CLIENT_SECRET_ARN!,
        wellknown: process.env.NL_WALLET_VERID_WELL_KNOWN!,
        redirectUrl: process.env.APPLICATION_URL_BASE + 'auth',
        clientOptions: {
          id_token_signed_response_alg: 'ES384',
        },
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

  async handleRequest() {
    let session = new Session(this.config.cookies, this.config.dynamoDBClient);
    await session.init();
    if (session.sessionId === false) {
      return Response.redirect('/login');
    }
    const state = session.getValue('state');
    try {
      let tokens = undefined;
      let user = undefined;

      // Find the correct openid connect configuration
      // Check for valid state for and call token endpoint
      if (this.config.useNlWalletSignicat && this.config.queryStringParamState.endsWith('-signicat')) {
        if (!this.oidcNlWalletSignicat) {
          throw Error('Expected ODIC configuration for NL Wallet using Signicat.');
        }
        const correctedState = this.config.queryStringParamState;
        tokens = await this.oidcNlWalletSignicat.authorize(this.config.queryStringParamCode, state + '-signicat', correctedState);
        user = this.userFromSignicatNlWalletFlow(tokens);
      } else if (this.config.useNlWalletVerId && this.config.queryStringParamState.endsWith('-verid')) {
        if (!this.oidcNlWalletVerId) {
          throw Error('Expected ODIC configuration for NL Wallet using VerID.');
        }
        const correctedState = this.config.queryStringParamState;
        tokens = await this.oidcNlWalletVerId.authorize(this.config.queryStringParamCode, state + '-verid', correctedState);
        user = this.userFromVerIdNlWalletFlow(tokens);
      } else {
        // Original flow
        tokens = await this.config.OpenIdConnect.authorize(this.config.queryStringParamCode, state, this.config.queryStringParamState);
        user = this.userFromTokens(tokens);
      }

      if (!user) {
        return Response.redirect('/login');
      }

      // Startup the session
      try {
        const username = await user.getUserName();

        // Optionally store delegated_token in the session
        let additional_session_data = {};
        if (this.config.authenticationService) {
          const delegated_token = await this.exchangeTokenWithOurOwnVerySpecialIdP(tokens.id_token!);
          additional_session_data = { delegated_token: { S: delegated_token } };
        }

        await session.createSession({
          loggedin: { BOOL: true },
          identifier: { S: user.identifier },
          bsn: { S: user.type == 'person' ? user.identifier : '' }, // TODO: remove when consuming pages (persoonsgegevens, uitkeringen, zaken) have been updated to use identifier
          user_type: { S: user.type },
          username: { S: username },
          id_token: { S: tokens.id_token },
          refresh_token: { S: tokens.refresh_token },
          xsrf_token: { S: this.config.OpenIdConnect.generateState() },
          ...additional_session_data,
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

  private logAuthMethod(claims: IdTokenClaims) {
    const logger = new Logger({ serviceName: 'mijnnijmegen' });
    if (claims.hasOwnProperty('acr') && claims.hasOwnProperty('amr')) {
      logger.info('auth succesful', { loa: claims.acr, method: claims.amr });
    }
  }


  /**
   * Get the BSN from the claims for a DigiD login
   * @param claims
   * @returns
   */
  bsnFromDigidLogin(claims: IdTokenClaims): Bsn {
    const subject = 'sub';
    if (claims[subject]) {
      return new Bsn(claims[subject] as string);
    }
    throw Error('Invalid or no bsn in DigiD claims!');
  }

  /**
   * Get the BSN from a Yivi login
   * @param claims
   * @returns
   */
  bsnFromYiviLogin(claims: IdTokenClaims): Bsn {
    const bsnAttribute = this.config.yiviBsnAttribute;
    console.log(this.config.yiviBsnAttribute, claims[bsnAttribute]);
    if (claims?.[bsnAttribute]) {
      return new Bsn(claims[bsnAttribute] as string);
    }
    throw Error('Invalid or no bsn in Yivi claims!');
  }

  /**
   * Get the KVK number and company name from a Yivi login
   * @param claims
   * @returns
   */
  kvkFromYiviLogin(claims: IdTokenClaims): { kvkNumber: string; organisationName: string } {
    let kvkNumberAttribute = this.config.yiviKvkNumberAttribute;
    let kvkNameAttribute = this.config.yiviKvkNameAttribute;
    const yiviKvkClaim = claims[kvkNumberAttribute] as string;
    const yiviNameClaim = claims[kvkNameAttribute] as string;
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
  kvkFromEherkenningLogin(claims: IdTokenClaims): { kvkNumber: string; organisationName: string } {
    const kvkClaim = claims?.[eHerkenningKvkNummerClaim] as string;
    const organisationNameClaim = claims?.[eHerkenningCompanyNameClaim] as string;
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
  userFromTokens(tokens: TokenSet): User {
    if (!tokens.scope || !tokens.claims) {
      throw Error('scope and claims expected');
    }
    const claims = tokens.claims();
    const scope = tokens.scope;
    const authMethod = this.authMethodFromScope(scope);

    let bsn = undefined;
    let kvk = undefined;

    if (authMethod == 'yivi') {
      const bsnClaim = claims[this.config.yiviBsnAttribute];
      const kvkClaim = claims[this.config.yiviKvkNumberAttribute];
      if (bsnClaim) {
        bsn = this.bsnFromYiviLogin(claims);
      }
      if (kvkClaim) {
        if (!this.config.useYiviKvk) { // Feature flag
          throw Error('Kvk login via Yivi is not enabled yet!');
        }
        kvk = this.kvkFromYiviLogin(claims);
      }
    }

    if (authMethod == 'digid') {
      bsn = this.bsnFromDigidLogin(claims);
    }

    if ( authMethod == 'eherkenning') {
      kvk = this.kvkFromEherkenningLogin(claims);
    }
    if (bsn || kvk) {
      this.logAuthMethod(claims);
    }

    if (bsn) {
      return new Person(bsn, { apiClient: this.config.apiClient });
    }

    if (kvk) {
      return new Organisation(kvk.kvkNumber, kvk.organisationName, { apiClient: this.config.apiClient });
    }

    throw Error('User authentication failed: No BSN or KVK found in request');
  }


  /**
   * Given a list of scopes issued by the IdP after authentication
   * determine the authentication method that is used
   * @param scope
   * @returns authentication method that is used
   */
  authMethodFromScope(scope: string) : AuthenticationMethod {
    if (scope.includes(this.config.yiviScope)) {
      return 'yivi';
    } else if (scope.includes(this.config.eherkenningScope)) {
      return 'eherkenning';
    } else if (scope.includes(this.config.digidScope)) {
      return 'digid';
    }
    throw Error('Unsupported authentication method');
  }

  async exchangeTokenWithOurOwnVerySpecialIdP(access_token: string) {
    return this.config.authenticationService?.exchangeToken(access_token);
  }

  private userFromVerIdNlWalletFlow(tokens: TokenSet) {
    const bsn = (tokens.claims() as any).nin?.identifier;
    if (!bsn) {
      throw Error('Could not find bsn in NL wallet login flow (VerID)');
    }
    return new Person(new Bsn(bsn), { apiClient: this.config.apiClient });
  }

  private userFromSignicatNlWalletFlow(tokens: TokenSet) {
    const claims = (tokens.claims() as any);
    const bsn = claims['irma-demo.gemeente.personalData.bsn']; // TODO replace with NL Wallet claim
    if (!bsn) {
      throw Error('Could not find bsn in NL wallet login flow (Signicat)');
    }
    return new Person(new Bsn(bsn), { apiClient: this.config.apiClient });
  }

}


interface UserConfig {
  apiClient: ApiClient;
}

/**
 * Several types of user exist:
 * - 'Natuurlijk persoon' (a human), having a BSN and a name (provided by the BRP)
 * - 'Organisation', having a KVK identification number, and a company name (provided by eherkenning)
 */
interface User {
  config: UserConfig;
  identifier: string;
  type: string;
  getUserName(): Promise<string>;
}

/**
 * Implementation of a 'natuurlijk persoon', a human, having a BSN.
 */
export class Person implements User {
  bsn: Bsn;
  config: UserConfig;
  identifier: string;
  userName?: string;
  type: string = 'person';
  constructor(bsn: Bsn, config: UserConfig) {
    this.bsn = bsn;
    this.identifier = bsn.bsn;
    this.config = config;
  }

  async getUserName(): Promise<string> {
    if (typeof this.userName !== 'string') {
      try {
        if (process.env.HAALCENTRAAL_LIVE == 'true') {
          const brpApi = new HaalCentraalApi();
          const brpData = await brpApi.getBrpData(this.bsn.bsn);
          this.userName = brpData?.naam?.volledigeNaam ? brpData.naam.volledigeNaam : 'Onbekende gebruiker';
        } else {
          const brpApi = new BrpApi(this.config.apiClient);
          const brpData = await brpApi.getBrpData(this.bsn.bsn);
          this.userName = brpData?.Persoon?.Persoonsgegevens?.Naam ? brpData.Persoon.Persoonsgegevens.Naam : 'Onbekende gebruiker';
        }
      } catch (error) {
        console.error('Error getting username');
        this.userName = 'Onbekende gebruiker';
      }
    }
    return this.userName as string;
  }
}

/**
 * Implementation of a user of type 'organisation', having a KVK number.
 */
export class Organisation implements User {
  kvk: string;
  config: UserConfig;
  identifier: string;
  userName: string;
  type: string = 'organisation';

  constructor(kvk: string, userName: string, config: UserConfig) {
    this.kvk = kvk;
    this.identifier = kvk;
    this.userName = userName ?? kvk;
    this.config = config;
  }

  async getUserName(): Promise<string> {
    return this.userName;
  }
}
