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

const ddbMock = mockClient(DynamoDBClient);

beforeEach(() => {
  ddbMock.mockReset();
});

test('Return login page with correct link', async () => {
  const result = await lambda.handler({}, {});
  expect(result.body).toMatch(`${process.env.AUTH_URL_BASE}/broker/sp/oidc/authenticate`);
  expect(result.body).toMatch(encodeURIComponent(`${process.env.APPLICATION_URL_BASE}auth`));
  expect(result.statusCode).toBe(200);
});

test('No redirect if session cookie doesn\'t exist', async () => {
  const result = await lambda.handler({ cookies: ['demo=12345'] }, {});
  expect(result.statusCode).toBe(200);
});

test('Create session if no session exists', async () => {

  await lambda.handler({}, {});

  expect(ddbMock).toHaveBeenCalledTimes(1);
  expect(ddbMock).toHaveBeenCalledWith(expect.objectContaining({
    input: expect.objectContaining({
      Item: expect.objectContaining({
        bsn: {
          S: '',
        },
        loggedin: {
          BOOL: false,
        },
      }),
      TableName: process.env.SESSION_TABLE,
    }),
  }));
});

test('Redirect to home if already logged in', async () => {
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
  const output: Partial<GetItemCommandOutput> = {}; //empty output
  ddbMock.mockImplementation(() => output);
  const sessionId = '12345';
  const result = await lambda.handler({ cookies: [`session=${sessionId}`] }, {});
  expect(ddbMock).toHaveBeenCalledTimes(2);
  expect(result.statusCode).toBe(200);
});

test('Known session without login returns login page, without creating new session', async () => {
  const output: Partial<GetItemCommandOutput> = {
    Item: {
      loggedin: {
        BOOL: false,
      },
    },
  };
  ddbMock.mockImplementation(() => output);
  const sessionId = '12345';
  const result = await lambda.handler({ cookies: [`session=${sessionId}`] }, {});
  expect(ddbMock).toHaveBeenCalledTimes(2);
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
  expect(result.statusCode).toBe(200);
});

test('Request without session returns session cookie', async () => {
  const result = await lambda.handler({}, {});
  expect(result.cookies).toEqual(
    expect.arrayContaining([expect.stringMatching('session=')]),
  );
});

test('DynamoDB error', async () => {
  ddbMock.mockImplementation(() => { throw new Error('Not supported!'); });
  const result = await lambda.handler({ cookies: ['session=12345'] }, {});
  expect(ddbMock).toHaveBeenCalledTimes(1);
  expect(result.statusCode).toBe(500);
});