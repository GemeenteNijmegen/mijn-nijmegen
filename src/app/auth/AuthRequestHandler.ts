import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { Bsn } from '@gemeentenijmegen/utils';
import { IdTokenClaims, TokenSet } from 'openid-client';
import { BrpApi } from './BrpApi';
import { OpenIDConnect } from '../../shared/OpenIDConnect';

type AuthenticationMethod = 'yivi' | 'digid' | 'eherkenning';

interface requestProps {
  cookies: string;
  queryStringParamCode: string;
  queryStringParamState: string;
  dynamoDBClient: DynamoDBClient;
  apiClient: ApiClient;
  OpenIdConnect: OpenIDConnect;
  yiviAttributes?: string;
}

export class AuthRequestHandler {
  private config: requestProps;
  constructor(props: requestProps) {
    this.config = props;
  }

  async handleRequest() {
    let session = new Session(this.config.cookies, this.config.dynamoDBClient);
    await session.init();
    if (session.sessionId === false) {

      return Response.redirect('/login');
    }
    const state = session.getValue('state');
    try {
      // Authorize the request
      const tokens = await this.config.OpenIdConnect.authorize(this.config.queryStringParamCode, state, this.config.queryStringParamState);

      // Load the principal data
      const user = this.userFromTokens(tokens);
      if (!user) {
        return Response.redirect('/login');
      }

      // Startup the session
      try {
        const username = await user.getUserName();

        await session.createSession({
          loggedin: { BOOL: true },
          identifier: { S: user.identifier },
          bsn: { S: user.type == 'person' ? user.identifier : '' }, // TODO: remove when consuming pages (persoonsgegevens, uitkeringen, zaken) have been updated to use identifier
          user_type: { S: user.type },
          username: { S: username },
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
    const bsnAttribute = process.env.YIVI_ATTRIBUTE_BSN!;
    if (claims[bsnAttribute]) {
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
    let kvkNumberAttribute = process.env.YIVI_ATTRIBUTE_KVK_NUMBER!;
    let kvkNameAttribute = process.env.YIVI_ATTRIBUTE_KVK_NAME!;
    const yiviKvkClaim = claims[kvkNumberAttribute] as string;
    const yiviNameClaim = claims[kvkNameAttribute] as string;
    if (yiviKvkClaim && Number.isInteger(parseInt(yiviKvkClaim))) {
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
    const kvkClaim = claims?.['urn:etoegang:1.9:EntityConcernedID:KvKnr'] as string;
    const organisationNameClaim = claims?.['urn:etoegang:1.11:attribute-represented:CompanyName'] as string;
    if (kvkClaim && Number.isInteger(parseInt(kvkClaim))) {
      return { kvkNumber: kvkClaim, organisationName: organisationNameClaim };
    }
    throw Error('Invalid eHerkenning login');
  }

  userFromTokens(tokens: TokenSet): User | false {
    if (!tokens.scope || !tokens.claims) {
      throw Error('scope and claims expected');
    }
    const claims = tokens.claims();
    const scope = tokens.scope;
    const authMethod = this.authMethodFromScope(scope);

    let bsn = undefined;
    let kvk = undefined;

    if (authMethod == 'yivi') {
      if (scope.includes(process.env.YIVI_ATTRIBUTE_BSN!)) {
        bsn = this.bsnFromYiviLogin(claims);
      }
      if (
        process.env.USE_YIVI_KVK === 'true' // Feature flag USE_YIVI_KVK
        && scope.includes(process.env.YIVI_ATTRIBUTE_KVK_NUMBER!)) {
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


  authMethodFromScope(scope: string) : AuthenticationMethod {
    const scopes = scope.split(' ');
    if (scopes.includes(process.env.YIVI_SCOPE!)) {
      return 'yivi';
    } else if (scopes.includes(process.env.EHERKENNING_SCOPE!)) {
      return 'eherkenning';
    } else if (scopes.includes(process.env.DIGID_SCOPE!)) {
      return 'digid';
    }
    throw Error('Unsupported authentication method');
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
class Person implements User {
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
        const brpApi = new BrpApi(this.config.apiClient);
        const brpData = await brpApi.getBrpData(this.bsn.bsn);
        this.userName = brpData?.Persoon?.Persoonsgegevens?.Naam ? brpData.Persoon.Persoonsgegevens.Naam : 'Onbekende gebruiker';
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
class Organisation implements User {
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
