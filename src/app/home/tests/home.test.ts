import { DynamoDBClient, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { SecretsManagerClient, GetSecretValueCommandOutput } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'jest-aws-client-mock';
import { FileApiClient } from '../FileApiClient';
import * as lambda from '../index';

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

beforeEach(() => {
  ddbMock.mockReset();
  secretsMock.mockReset();
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      loggedin: {
        BOOL: true,
      },
      bsn: {
        S: '12345678',
      },
      state: {
        S: '12345',
      },
    },
  };
  ddbMock.mockImplementation(() => getItemOutput);
});

test('Returns 200', async () => {
  const output: GetSecretValueCommandOutput = {
    $metadata: {},
    SecretString: 'ditiseennepgeheim',
  };
  secretsMock.mockImplementation(() => output);
  const client = new FileApiClient();
  const result = await lambda.requestHandler('session=12345', client);
  expect(result.statusCode).toBe(200);
});

test('Shows overview page', async () => {
  const output: GetSecretValueCommandOutput = {
    $metadata: {},
    SecretString: 'ditiseennepgeheim',
  };
  secretsMock.mockImplementation(() => output);
  const client = new FileApiClient();
  const result = await lambda.requestHandler('session=12345', client);
  expect(result.body).toMatch('Mijn Uitkering');
  expect(result.body).toMatch('Participatiewet');
});