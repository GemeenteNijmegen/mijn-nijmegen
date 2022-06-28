import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { SecretsManagerClient, GetSecretValueCommandOutput, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import { handleRequest } from '../handleRequest';

beforeAll(() => {

  if (process.env.VERBOSETESTS!='True') {
    global.console.error = jest.fn();
    global.console.time = jest.fn();
    global.console.log = jest.fn();
  }

  // Set env variables
  process.env.SESSION_TABLE = 'mijnuitkering-sessions';
  process.env.AUTH_URL_BASE = 'https://authenticatie-accp.nijmegen.nl';
  process.env.APPLICATION_URL_BASE = 'https://testing.example.com/';
  process.env.CLIENT_SECRET_ARN = '123';
  process.env.OIDC_CLIENT_ID = '1234';
  process.env.OIDC_SCOPE = 'openid';

  const output: GetSecretValueCommandOutput = {
    $metadata: {},
    SecretString: 'ditiseennepgeheim',
  };
  secretsMock.on(GetSecretValueCommand).resolves(output);

});

const ddbMock = mockClient(DynamoDBClient);
const secretsMock = mockClient(SecretsManagerClient);


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
  ddbMock.reset();
});

test('Successful auth redirects to home', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const sessionId = '12345';
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      data: {
        M: {
          loggedin: { BOOL: true },
          bsn: { S: '12345678' },
          state: { S: '12345' },
        },
      },
    },
  };
  ddbMock.on(GetItemCommand).resolves(getItemOutput);

  const result = await handleRequest(`session=${sessionId}`, 'state', '12345', dynamoDBClient);
  expect(result.statusCode).toBe(302);
  expect(result.headers.Location).toBe('/');
});


test('Successful auth creates new session', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const sessionId = '12345';
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      data: {
        M: {
          loggedin: { BOOL: false },
          state: { S: '12345' },
        },
      },
    },
  };
  ddbMock.on(GetItemCommand).resolves(getItemOutput);


  const result = await handleRequest(`session=${sessionId}`, 'state', '12345', dynamoDBClient);
  expect(result.statusCode).toBe(302);
  expect(result.headers.Location).toBe('/');
  expect(result.cookies).toContainEqual(expect.stringContaining('session='));
});

test('No session redirects to login', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const result = await handleRequest('', 'state', 'state', dynamoDBClient);
  expect(result.statusCode).toBe(302);
  expect(result.headers.Location).toBe('/login');
});


test('Incorrect state errors', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const sessionId = '12345';
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
  ddbMock.on(GetItemCommand).resolves(getItemOutput);
  const logSpy = jest.spyOn(console, 'error');
  const result = await handleRequest(`session=${sessionId}`, '12345', 'returnedstate', dynamoDBClient);
  expect(result.statusCode).toBe(302);
  expect(result.headers.Location).toBe('/login');
  expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('state does not match session state'));
});