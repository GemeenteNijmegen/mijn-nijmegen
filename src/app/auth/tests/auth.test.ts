import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { SecretsManagerClient, GetSecretValueCommandOutput, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Bsn } from '@gemeentenijmegen/utils';
import { mockClient } from 'aws-sdk-client-mock';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { IdTokenClaims } from 'openid-client';
import { OpenIDConnect } from '../../../shared/OpenIDConnect';
import { AuthRequestHandler, AuthRequestHandlerProps, Organisation, Person } from '../AuthRequestHandler';

const scopesAndAttributes = {
  digidScope: 'idp_scoping:digid',
  eherkenningScope: 'idp_scoping:eherkenning',
  yiviScope: 'idp_scoping:yivi',
  yiviBsnAttribute: 'pbdf.gemeente.personalData.bsn',
  yiviKvkNumberAttribute: 'pbdf.signicat.kvkTradeRegister.kvkNumber',
  yiviKvkNameAttribute: 'pbdf.signicat.kvkTradeRegister.name',
  useYiviKvk: true,
};

function mockedOidcClient(authorized = true) {
  const oidc = new OpenIDConnect();
  oidc.getOidcClientSecret = async () => '123';
  if (authorized) {
    oidc.authorize = jest.fn().mockResolvedValue({
      claims: () => {
        return { sub: '900222670' };
      },
      scope: 'openid idp_scoping:digid',
    });
  } else {
    oidc.authorize = jest.fn().mockRejectedValue('state does not match session state');
  }
  return oidc;
}

const axiosMock = new MockAdapter(axios);
beforeAll(() => {

  if (process.env.VERBOSETESTS != 'True') {
    // global.console.error = jest.fn();
    // global.console.time = jest.fn();
    // global.console.log = jest.fn();
  }

  // Set env variables
  process.env.SESSION_TABLE = 'mijnuitkering-sessions';
  process.env.AUTH_URL_BASE = 'https://authenticatie-accp.nijmegen.nl';
  process.env.APPLICATION_URL_BASE = 'https://testing.example.com/';
  process.env.CLIENT_SECRET_ARN = '123';
  process.env.OIDC_CLIENT_ID = '1234';
  process.env.OIDC_SCOPE = 'openid';
  process.env.BRP_API_URL = 'https://example.com/brpapi';

  const output: GetSecretValueCommandOutput = {
    $metadata: {},
    SecretString: 'ditiseennepgeheim',
  };
  secretsMock.on(GetSecretValueCommand).resolves(output);

});

const ddbMock = mockClient(DynamoDBClient);
const secretsMock = mockClient(SecretsManagerClient);
const apiClient = new ApiClient('', '', '');
const OIDC = mockedOidcClient(true);
const sessionId = '12345';

beforeEach(() => {
  ddbMock.reset();
  axiosMock.reset();
  axiosMock.onPost(process.env.BRP_API_URL).reply(200, {
    Persoon: {
      BSN: {
        BSN: '900222670',
      },
      Persoonsgegevens: {
        Voorletters: 'A.',
        Voornamen: 'Arnoud',
        Voorvoegsel: 'de',
        Geslachtsnaam: 'Smit',
        Achternaam: 'de Smit',
        Naam: 'A. de Smit',
      },
    },
  });
});

function setupSessionResponse(loggedin: boolean) {
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      data: {
        M: {
          loggedin: { BOOL: loggedin },
          bsn: { S: '12345678' },
          state: { S: 'state' },
        },
      },
    },
  };
  ddbMock.on(GetItemCommand).resolves(getItemOutput);
}

describe('Auth handler', () => {
  test('Successful auth redirects to home', async () => {
    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });

    setupSessionResponse(true);
    const handler = new AuthRequestHandler({
      cookies: `session=${sessionId}`,
      queryStringParamState: 'state',
      queryStringParamCode: '12345',
      dynamoDBClient,
      apiClient,
      OpenIdConnect: OIDC,
      ...scopesAndAttributes,
    });
    const result = await handler.handleRequest();
    expect(result.statusCode).toBe(302);
    expect(result?.headers?.Location).toBe('/');
  });

  test('Successful auth creates new session', async () => {
    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });

    setupSessionResponse(false);

    const handler = new AuthRequestHandler({
      cookies: `session=${sessionId}`,
      queryStringParamState: 'state',
      queryStringParamCode: '12345',
      dynamoDBClient,
      apiClient,
      OpenIdConnect: OIDC,
      ...scopesAndAttributes,
    });
    const result = await handler.handleRequest();
    expect(result.statusCode).toBe(302);
    expect(result?.headers?.Location).toBe('/');
    expect(result.cookies).toContainEqual(expect.stringContaining('session='));
  });

  test('No session redirects to login', async () => {
    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
    const handler = new AuthRequestHandler({
      cookies: '',
      queryStringParamState: 'state',
      queryStringParamCode: 'state',
      dynamoDBClient,
      apiClient,
      OpenIdConnect: OIDC,
      ...scopesAndAttributes,
    });
    const result = await handler.handleRequest();
    expect(result.statusCode).toBe(302);
    expect(result?.headers?.Location).toBe('/login');
  });
});


describe('DigiD logins', () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const handlerAttributes: AuthRequestHandlerProps = {
    cookies: `session=${sessionId}`,
    queryStringParamState: 'state',
    queryStringParamCode: '12345',
    dynamoDBClient,
    apiClient,
    OpenIdConnect: OIDC,
    ...scopesAndAttributes,
  };
  const handler = new AuthRequestHandler(handlerAttributes);
  test('bsn in sub', async () => {
    const claims: IdTokenClaims = {
      aud: 'test',
      exp: 123,
      iat: 123,
      iss: 'test',
      sub: '900222670',
    };

    const bsn = handler.bsnFromDigidLogin(claims);
    expect(bsn).toBeInstanceOf(Bsn);
    expect(bsn).toBeTruthy();
    if (bsn) {
      expect(bsn.bsn).toBe('900222670');
    }
  });
  test('No bsn in sub claim throws', async () => {
    const claims: IdTokenClaims = {
      aud: 'test',
      exp: 123,
      iat: 123,
      iss: 'test',
      sub: 'test',
    };
    expect(() => {
      handler.bsnFromDigidLogin(claims);
    }).toThrow();
  });
});


describe('Yivi logins', () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const handlerAttributes: AuthRequestHandlerProps = {
    cookies: `session=${sessionId}`,
    queryStringParamState: 'state',
    queryStringParamCode: '12345',
    dynamoDBClient,
    apiClient,
    OpenIdConnect: OIDC,
    ...scopesAndAttributes,
  };
  const handler = new AuthRequestHandler(handlerAttributes);

  test('Can login with bsn', async () => {
    const claims: IdTokenClaims = {
      aud: 'test',
      exp: 123,
      iat: 123,
      iss: 'test',
      sub: 'test',
      ['pbdf.gemeente.personalData.bsn']: '900070341',
    };

    const tokens = {
      claims: () => claims,
      scope: 'openid idp_scoping:yivi condisconscopewithbase64isignored',
    };

    const user = handler.userFromTokens(tokens as any);
    expect(user.identifier).toBe('900070341');
    expect(user).toBeInstanceOf(Person);
  });

  test('Can login with kvk', async () => {
    const claims: IdTokenClaims = {
      aud: 'test',
      exp: 123,
      iat: 123,
      iss: 'test',
      sub: 'test',
      ['pbdf.signicat.kvkTradeRegister.kvkNumber']: '123456',
      ['pbdf.signicat.kvkTradeRegister.name']: 'test company',
    };
    const tokens = {
      claims: () => claims,
      scope: 'openid idp_scoping:yivi condisconscopewithbase64isignored',
    };
    const user = handler.userFromTokens(tokens as any);
    expect(user.identifier).toBe('123456');
    expect(user).toBeInstanceOf(Organisation);
  });

  test('Cannot login without kvk name', async () => {
    const claims: IdTokenClaims = {
      aud: 'test',
      exp: 123,
      iat: 123,
      iss: 'test',
      sub: 'test',
      ['pbdf.signicat.kvkTradeRegister.kvkNumber']: '123456',
    };
    const tokens = {
      claims: () => claims,
      scope: 'openid idp_scoping:yivi condisconscopewithbase64isignored',
    };
    expect(() => {
      handler.userFromTokens(tokens as any);
    }).toThrow();
  });

  test('Can login without bsn in claims', async () => {
    const claims: IdTokenClaims = {
      aud: 'test',
      exp: 123,
      iat: 123,
      iss: 'test',
      sub: 'test',
    };
    const tokens = {
      claims: () => claims,
      scope: 'openid idp_scoping:yivi',
    };
    expect(() => {handler.userFromTokens(tokens as any);}).toThrow();
  });


  test('bsn from yivi claims', () => {
    const claims = {
      'sub': 'test',
      'aud': 'cleintid',
      'iss': 'test',
      'exp': 234,
      'iat': 234,
      'pbdf.gemeente.personalData.bsn': '900026236',
    };
    handler.bsnFromYiviLogin(claims as any);
  });

});


describe('Yivi logins (kvk feature flag off)', () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const handlerAttributes: AuthRequestHandlerProps = {
    cookies: `session=${sessionId}`,
    queryStringParamState: 'state',
    queryStringParamCode: '12345',
    dynamoDBClient,
    apiClient,
    OpenIdConnect: OIDC,
    ...scopesAndAttributes,
    useYiviKvk: false,
  };
  const handler = new AuthRequestHandler(handlerAttributes);

  test('Can login with bsn', async () => {
    const claims: IdTokenClaims = {
      aud: 'test',
      exp: 123,
      iat: 123,
      iss: 'test',
      sub: 'test',
      ['pbdf.gemeente.personalData.bsn']: '900070341',
    };

    const tokens = {
      claims: () => claims,
      scope: 'openid idp_scoping:yivi condisconscopewithbase64isignored',
    };

    const user = handler.userFromTokens(tokens as any);
    expect(user.identifier).toBe('900070341');
    expect(user).toBeInstanceOf(Person);
  });

  test('Cannot login with kvk', async () => {
    const claims: IdTokenClaims = {
      aud: 'test',
      exp: 123,
      iat: 123,
      iss: 'test',
      sub: 'test',
      ['pbdf.signicat.kvkTradeRegister.kvkNumber']: '123456',
      ['pbdf.signicat.kvkTradeRegister.name']: 'test company',
    };
    const tokens = {
      claims: () => claims,
      scope: 'openid idp_scoping:yivi pbdf.signicat.kvkTradeRegister.kvkNumber pbdf.signicat.kvkTradeRegister.name',
    };
    expect(() => {handler.userFromTokens(tokens as any);}).toThrow();
  });
});

describe('eHerkenning logins', () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const handlerAttributes: AuthRequestHandlerProps = {
    cookies: `session=${sessionId}`,
    queryStringParamState: 'state',
    queryStringParamCode: '12345',
    dynamoDBClient,
    apiClient,
    OpenIdConnect: OIDC,
    ...scopesAndAttributes,
  };
  const scope = 'openid idp_scoping:eherkenning';
  const claims: IdTokenClaims = {
    aud: 'test',
    exp: 123,
    iat: 123,
    iss: 'test',
    sub: 'PSEUDORANDOMSTRING',
    ['urn:etoegang:1.9:EntityConcernedID:KvKnr']: '12345678',
    ['urn:etoegang:1.11:attribute-represented:CompanyName']: 'My Company',
  };

  test('urn:etoegang:1.9:EntityConcernedID:KvKnr in claims returns kvk', async () => {
    const handler = new AuthRequestHandler(handlerAttributes);
    const kvk = handler.kvkFromEherkenningLogin(claims);
    expect(kvk).toBeTruthy();
    if (kvk) {
      expect(kvk.kvkNumber).toBe('12345678');
    }
  });

  test('kvk login sets username', async () => {
    const handler = new AuthRequestHandler(handlerAttributes);
    const kvk = handler.kvkFromEherkenningLogin(claims);
    expect(kvk).toBeTruthy();
    if (kvk) {
      expect(kvk.kvkNumber).toBe('12345678');
      expect(kvk.organisationName).toBe('My Company');
    }
  });

  test('kvk login sets organisation type user', async () => {
    const handler = new AuthRequestHandler(handlerAttributes);
    const tokens = { claims: () => claims, scope };
    const user = handler.userFromTokens(tokens as any);
    expect(user).toBeTruthy();
    if (user) {
      expect(await user.getUserName()).toBe('My Company');
      expect(await user.type).toBe('organisation');
    }
  });
});
