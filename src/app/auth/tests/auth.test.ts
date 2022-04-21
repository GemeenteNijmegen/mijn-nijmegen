import { DynamoDBClient, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { SecretsManagerClient, GetSecretValueCommandOutput } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'jest-aws-client-mock';
import { handleRequest } from '../handleRequest';

beforeAll(() => {
  global.console.log = jest.fn();
  // Set env variables
  process.env.SESSION_TABLE = 'mijnuitkering-sessions';
  process.env.AUTH_URL_BASE = 'https://authenticatie-accp.nijmegen.nl';
  process.env.APPLICATION_URL_BASE = 'https://testing.example.com/';
  process.env.CLIENT_SECRET_ARN = '123';
  process.env.OIDC_CLIENT_ID = '1234';
  process.env.OIDC_SCOPE = 'openid';
});

const ddbMock = mockClient(DynamoDBClient);
const secretsMock = mockClient(SecretsManagerClient);

const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });


jest.mock('openid-client', () => {
  const originalClient = jest.requireActual('openid-client');
  return {
    ...originalClient,
    Issuer: jest.fn(() => {
      const originalIssuer = jest.requireActual('openid-client/lib/issuer');
      return {
        Client: jest.fn(() => {
          return {
            callback: jest.fn(() => {
              return {
                claims: jest.fn(() => {
                  return {
                    aud: process.env.OIDC_CLIENT_ID,
                    sub: '12345',
                  };
                }),
              };
            }),
            callbackParams: jest.fn(() => {}),
          };
        }),
        ...originalIssuer,
      };
    }),
  };
});

beforeEach(() => {
  ddbMock.mockReset();
  secretsMock.mockReset();
});

test('Successful auth redirects to home', async () => {
  const sessionId = '12345';
  const output: GetSecretValueCommandOutput = {
    $metadata: {},
    SecretString: 'ditiseennepgeheim',
  };
  secretsMock.mockImplementation(() => output);
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      loggedin: {
        BOOL: false,
      },
      state: {
        S: '12345',
      },
    },
  };
  ddbMock.mockImplementation(() => getItemOutput);

  const result = await handleRequest(`session=${sessionId}`, 'state', '12345', dynamoDBClient);
  expect(result.statusCode).toBe(302);
  expect(result.headers.Location).toBe('/');
});


test('Successful auth creates new session', async () => {
  const sessionId = '12345';
  const output: GetSecretValueCommandOutput = {
    $metadata: {},
    SecretString: 'ditiseennepgeheim',
  };
  secretsMock.mockImplementation(() => output);
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      loggedin: {
        BOOL: false,
      },
      state: {
        S: '12345',
      },
    },
  };
  ddbMock.mockImplementation(() => getItemOutput);


  const result = await handleRequest(`session=${sessionId}`, 'state', '12345', dynamoDBClient);
  expect(ddbMock).toHaveBeenCalledWith(
    expect.objectContaining({
      input: {
        Key: {
          sessionid: { S: sessionId },
        },
        TableName: process.env.SESSION_TABLE,
      },
    }),
  );
  expect(ddbMock).toHaveBeenCalledWith(
    expect.objectContaining({
      input: {
        Item: expect.objectContaining({
          'bsn': { S: '12345' },
          'loggedin': { BOOL: true },
        }),
        TableName: process.env.SESSION_TABLE,
      },
    }),
  );
  expect(result.statusCode).toBe(302);
  expect(result.headers.Location).toBe('/');
  expect(result.cookies).toContainEqual(expect.stringContaining('session='));
});

test('No session redirects to login', async () => {
  const result = await handleRequest('', 'state', 'state', dynamoDBClient);
  expect(result.statusCode).toBe(302);
  expect(result.headers.Location).toBe('/login');
});


test('Incorrect state errors', async () => {
  const sessionId = '12345';
  const output: GetSecretValueCommandOutput = {
    $metadata: {},
    SecretString: 'ditiseennepgeheim',
  };
  secretsMock.mockImplementation(() => output);
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      loggedin: {
        BOOL: false,
      },
      state: {
        S: '12345',
      },
    },
  };
  ddbMock.mockImplementation(() => getItemOutput);
  const logSpy = jest.spyOn(console, 'error');
  const result = await handleRequest(`session=${sessionId}`, '12345', 'returnedstate', dynamoDBClient);
  expect(result.statusCode).toBe(302);
  expect(result.headers.Location).toBe('/login');
  expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('state does not match session state'));
});