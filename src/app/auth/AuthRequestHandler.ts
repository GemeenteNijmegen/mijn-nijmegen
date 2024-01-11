import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { Bsn } from '@gemeentenijmegen/utils';
import { IdTokenClaims } from 'openid-client';
import { BrpApi } from './BrpApi';
import { OpenIDConnect } from '../../shared/OpenIDConnect';

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
    const logger = new Logger({ serviceName: 'mijnnijmegen' });
    let session = new Session(this.config.cookies, this.config.dynamoDBClient);
    await session.init();
    if (session.sessionId === false) {

      return Response.redirect('/login');
    }
    const state = session.getValue('state');
    try {
      const claims = await this.config.OpenIdConnect.authorize(this.config.queryStringParamCode, state, this.config.queryStringParamState);
      if (claims) {
        const user = this.userFromClaims(claims);
        if (!user) {
          return Response.redirect('/login');
        }
        this.logAuthMethod(claims, logger);

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
          console.error(error.message);
          return Response.error(500);
        }
      } else {
        return Response.redirect('/login');
      }
    } catch (error: any) {
      console.error(error.message);
      return Response.redirect('/login');
    }
    return Response.redirect('/', 302, [session.getCookie()]);
  }

  private logAuthMethod(claims: IdTokenClaims, logger: Logger) {
    if (claims.hasOwnProperty('acr') && claims.hasOwnProperty('amr')) {
      logger.info('auth succesful', { loa: claims.acr, method: claims.amr });
    }
  }

  /**
   * Extract bsn from token claims
   *
   * The bsn can be found in several fields: either the 'sub' claim
   * or a yivi-specific field can be used. This function tries (in order)
   * to get a valid BSN from:
   * - sub
   * - any values in space separated yivi attributes string, in order
   *
   * @param claims an IdTokenClaims object
   * @returns {BSN|false}
   */
  bsnFromClaims(claims: IdTokenClaims): Bsn | false {
    let possibleClaims = ['sub'];
    if (typeof this.config?.yiviAttributes === 'string') {
      const yiviClaims = this.config.yiviAttributes.split(' ').filter(val => val !== '');
      possibleClaims = [...possibleClaims, ...yiviClaims];
    }
    for (const type of possibleClaims) {
      try {
        if (claims[type]) {
          return new Bsn(claims[type] as string);
        }
      } catch (error: any) {
        // we don't care about non-valid BSN's (sub could have a random string)
      }
    }
    return false;
  }

  /** Extract kvk number from token claims
   *
   * Checks if there's a value, and if this value is numeric.
   * Returns the kvk as a string, or false if validation fails/there is no kvk.
   */
  kvkFromClaims(claims: IdTokenClaims): { kvkNumber: string; organisationName: string } | false {
    const kvkClaim = claims?.['urn:etoegang:1.9:EntityConcernedID:KvKnr'] as string;
    const organisationNameClaim = claims?.['urn:etoegang:1.11:attribute-represented:CompanyName'] as string;
    if (kvkClaim && Number.isInteger(parseInt(kvkClaim))) {
      return { kvkNumber: kvkClaim, organisationName: organisationNameClaim };
    }
    return false;
  }

  userFromClaims(claims: IdTokenClaims): User | false {
    const bsn = this.bsnFromClaims(claims);
    const kvk = this.kvkFromClaims(claims);
    let user: User | null = null;
    if (!bsn && !kvk) {
      return false;
    }

    if (bsn) {
      user = new Person(bsn, { apiClient: this.config.apiClient });
    } else if (kvk) {
      user = new Organisation(kvk.kvkNumber, kvk.organisationName, { apiClient: this.config.apiClient });
    }
    return user ?? false;
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
    this.userName = userName;
    this.config = config;
  }

  async getUserName(): Promise<string> {
    return this.userName;
  }
}
