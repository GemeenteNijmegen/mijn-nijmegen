import { DynamoDBClient, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'jest-aws-client-mock';
import * as lambda from '../index';

beforeAll(() => {
  global.console.log = jest.fn();
  // Set env variables
  process.env.SESSION_TABLE = 'mijnuitkering-sessions';
  process.env.AUTH_URL_BASE = 'https://authenticatie-accp.nijmegen.nl';
  process.env.APPLICATION_URL_BASE = 'https://testing.example.com/';
  process.env.OIDC_SECRET_ARN = '123';
  process.env.OIDC_CLIENT_ID = '1234';
  process.env.OIDC_SCOPE = 'openid';
});

test('Return login page with correct link', async () => {
  const result = await lambda.handler({}, {});
  expect(result.body).toMatch('&scope=openid');
  expect(result.statusCode).toBe(200);
});

test('No redirect if session cookie doesn\'t exist', async () => {
  const result = await lambda.handler({ cookies: ['demo=12345'] }, {});
  expect(result.statusCode).toBe(200);
});

test('Redirect to home if already logged in', async () => {
  const ddbMock = mockClient(DynamoDBClient);
  const output: Partial<GetItemCommandOutput> = {
    Item: {
      loggedin: {
        BOOL: true,
      },
    },
  };
  ddbMock.mockImplementation(() => output);
  const sessionId = '12345';
  const result = await lambda.handler({ cookies: [`session=${sessionId}`] }, {});
  expect(ddbMock).toHaveBeenCalledTimes(1);
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
  expect(result.statusCode).toBe(302);
});

test('Unknown session returns login page', async () => {
  const ddbMock = mockClient(DynamoDBClient);
  const output: Partial<GetItemCommandOutput> = {}; //empty output
  ddbMock.mockImplementation(() => output);
  const sessionId = '12345';
  const result = await lambda.handler({ cookies: [`session=${sessionId}`] }, {});
  expect(ddbMock).toHaveBeenCalledTimes(1);
  expect(result.statusCode).toBe(200);
});

test('DynamoDB error', async () => {
  const ddbMock = mockClient(DynamoDBClient);
  ddbMock.mockImplementation(() => { throw new Error('Not supported!'); });
  const result = await lambda.handler({ cookies: ['session=12345'] }, {});
  expect(ddbMock).toHaveBeenCalledTimes(1);
  expect(result.statusCode).toBe(500);
});
