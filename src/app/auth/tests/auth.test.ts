import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { SecretsManagerClient, GetSecretValueCommandOutput, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Bsn } from '@gemeentenijmegen/utils';
import { mockClient } from 'aws-sdk-client-mock';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { IdTokenClaims } from 'openid-client';
import { OpenIDConnect } from '../../../shared/OpenIDConnect';
import { bsnFromClaims, handleRequest } from '../handleRequest';


function mockedOidcClient(authorized = true) {
  const oidc = new OpenIDConnect();
  oidc.getOidcClientSecret = async () => '123';
  if (authorized) {
    oidc.authorize = jest.fn().mockResolvedValue({
      sub: '900222670',
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

test('Successful auth redirects to home', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });

  setupSessionResponse(true);
  const result = await handleRequest({
    cookies: `session=${sessionId}`,
    queryStringParamState: 'state',
    queryStringParamCode: '12345',
    dynamoDBClient,
    apiClient,
    OpenIdConnect: OIDC,
  });
  expect(result.statusCode).toBe(302);
  expect(result?.headers?.Location).toBe('/');
});

test('Successful auth creates new session', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });

  setupSessionResponse(false);

  const result = await handleRequest({
    cookies: `session=${sessionId}`,
    queryStringParamState: 'state',
    queryStringParamCode: '12345',
    dynamoDBClient,
    apiClient,
    OpenIdConnect: OIDC,
  });
  expect(result.statusCode).toBe(302);
  expect(result?.headers?.Location).toBe('/');
  expect(result.cookies).toContainEqual(expect.stringContaining('session='));
});

test('No session redirects to login', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const result = await handleRequest({
    cookies: '',
    queryStringParamState: 'state',
    queryStringParamCode: 'state',
    dynamoDBClient,
    apiClient,
    OpenIdConnect: OIDC,
  });
  expect(result.statusCode).toBe(302);
  expect(result?.headers?.Location).toBe('/login');
});

describe('Get bsn from claims object', () => {
  test('bsn in sub', async () => {
    const claims: IdTokenClaims = {
      aud: 'test',
      exp: 123,
      iat: 123,
      iss: 'test',
      sub: '900222670',
    };
    const bsn = bsnFromClaims(claims);
    expect(bsn).toBeInstanceOf(Bsn);
    expect(bsn).toBeTruthy();
    if (bsn) {
      expect(bsn.bsn).toBe('900222670');
    }
  });
  test('bsn in irma-demo.gemeente.personalData.bsn', async () => {
    const claims: IdTokenClaims = {
      aud: 'test',
      exp: 123,
      iat: 123,
      iss: 'test',
      sub: 'test',
      ['irma-demo.gemeente.personalData.bsn']: '900070341',
    };
    const bsn = bsnFromClaims(claims);
    expect(bsn).toBeInstanceOf(Bsn);
    expect(bsn).toBeTruthy();
    if (bsn) {
      expect(bsn.bsn).toBe('900070341');
    }
  });

  test('bsn in pbdf.gemeente.bsn.bsn', async () => {
    const claims: IdTokenClaims = {
      aud: 'test',
      exp: 123,
      iat: 123,
      iss: 'test',
      sub: 'test',
      ['pbdf.gemeente.bsn.bsn']: '900070341',
    };
    const bsn = bsnFromClaims(claims);
    expect(bsn).toBeInstanceOf(Bsn);
    expect(bsn).toBeTruthy();
    if (bsn) {
      expect(bsn.bsn).toBe('900070341');
    }
  });

  test('bsn in sub and irma-demo.gemeente.personalData.bsn uses first', async () => {
    const claims: IdTokenClaims = {
      aud: 'test',
      exp: 123,
      iat: 123,
      iss: 'test',
      sub: '900222670',
      ['irma-demo.gemeente.personalData.bsn']: '900070341',
    };
    const bsn = bsnFromClaims(claims);
    expect(bsn).toBeInstanceOf(Bsn);
    expect(bsn).toBeTruthy();
    if (bsn) {
      expect(bsn.bsn).toBe('900222670');
    }
  });

  test('No bsn in claims returns false', async () => {
    const claims: IdTokenClaims = {
      aud: 'test',
      exp: 123,
      iat: 123,
      iss: 'test',
      sub: 'test',
    };
    const bsn = bsnFromClaims(claims);
    expect(bsn).not.toBeInstanceOf(Bsn);
    expect(bsn).toBeFalsy();
  });
});