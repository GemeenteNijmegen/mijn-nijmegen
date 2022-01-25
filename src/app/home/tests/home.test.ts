import { DynamoDBClient, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'jest-aws-client-mock';
import * as lambda from '../index';

const ddbMock = mockClient(DynamoDBClient);
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

beforeEach(() => {
  ddbMock.mockReset();
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      loggedin: {
        BOOL: true,
      },
      state: {
        S: '12345',
      },
    },
  };
  ddbMock.mockImplementation(() => getItemOutput);
});

test('Returns 200', async () => {
  const result = await lambda.handler({ cookies: ['session=12345'] }, {});
  expect(result.statusCode).toBe(200);
});

test('Shows overview page', async () => {
  const result = await lambda.handler({ cookies: ['session=12345'] }, {});
  expect(result.body).toMatch('Mijn Uitkering');
});