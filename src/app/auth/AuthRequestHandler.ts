import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { Bsn } from '@gemeentenijmegen/utils';
import { IdTokenClaims } from 'openid-client';
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
    const logger = new Logger({ serviceName: 'mijnnijmegen' });
    let session = new Session(this.config.cookies, this.config.dynamoDBClient);
    await session.init();
    if (session.sessionId === false) {

      return Response.redirect('/login');
    }
    const state = session.getValue('state');
    try {
      // Authorize the request
      const tokens = await this.config.OpenIdConnect.authorize(this.config.queryStringParamCode, state, this.config.queryStringParamState);
      const claims = tokens.claims();
      const scope = tokens.scope;
      if (!claims || !scope) {
        return Response.redirect('/login');
      }

      // Load the principal data
      const user = this.userFromClaims(claims, scope);
      if (!user) {
        return Response.redirect('/login');
      }
      this.logAuthMethod(claims, logger);

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

  private logAuthMethod(claims: IdTokenClaims, logger: Logger) {
    if (claims.hasOwnProperty('acr') && claims.hasOwnProperty('amr')) {
      logger.info('auth succesful', { loa: claims.acr, method: claims.amr });
    }
  }


  bsnFromDigidLogin(claims: IdTokenClaims): Bsn | false {
    const subject = 'sub';
    if (claims[subject]) {
      return new Bsn(claims[subject] as string);
    }
    throw Error('Invalid or no bsn in DigiD claims!');
  }

  bsnFromYiviLogin(claims: IdTokenClaims): Bsn | false {
    const bsnAttribute = process.env.YIVI_ATTRIBUTE_BSN!;
    if (claims[bsnAttribute]) {
      return new Bsn(claims[bsnAttribute] as string);
    }
    throw Error('Invalid or no bsn in Yivi claims!');
  }

  kvkFromYiviLogin(claims: IdTokenClaims): { kvkNumber: string; organisationName: string } | false {
    let kvkNumberAttribute = process.env.YIVI_ATTRIBUTE_KVK_NUMBER!;
    let kvkNameAttribute = process.env.YIVI_ATTRIBUTE_KVK_NAME!;
    const yiviKvkClaim = claims[kvkNumberAttribute] as string;
    const yiviNameClaim = claims[kvkNameAttribute] as string;
    if (yiviKvkClaim && Number.isInteger(parseInt(yiviKvkClaim))) {
      return { kvkNumber: yiviKvkClaim, organisationName: yiviNameClaim };
    }
    throw Error('Invalid or no kvk in Yivi claims!');
  }

  kvkFromEherkenningLogin(claims: IdTokenClaims): { kvkNumber: string; organisationName: string } | false {
    const kvkClaim = claims?.['urn:etoegang:1.9:EntityConcernedID:KvKnr'] as string;
    const organisationNameClaim = claims?.['urn:etoegang:1.11:attribute-represented:CompanyName'] as string;
    if (kvkClaim && Number.isInteger(parseInt(kvkClaim))) {
      return { kvkNumber: kvkClaim, organisationName: organisationNameClaim };
    }
    return false;
  }

  userFromClaims(claims: IdTokenClaims, scope: string): User | false {
    const authMethod = this.authMethodFromScope(scope);

    let bsn = undefined;
    let kvk = undefined;

    if (authMethod == 'yivi') {
      if (scope.includes(process.env.YIVI_ATTRIBUTE_BSN!)) {
        bsn = this.bsnFromYiviLogin(claims);
      }
      if (scope.includes(process.env.YIVI_ATTRIBUTE_KVK_NUMBER!)) {
        kvk = this.kvkFromYiviLogin(claims);
      }
    }

    if (authMethod == 'digid') {
      bsn = this.bsnFromDigidLogin(claims);
    }

    if ( authMethod == 'eherkenning') {
      kvk = this.kvkFromEherkenningLogin(claims);
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
    if (scopes.includes('idp_scoping:yivi')) {
      return 'yivi';
    } else if (scopes.includes('idp_scoping:eherkenning')) {
      return 'eherkenning';
    } else if (scopes.includes('idp_scoping:digid')) {
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
