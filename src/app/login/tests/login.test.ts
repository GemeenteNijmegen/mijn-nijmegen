import { writeFile } from 'fs';
import * as path from 'path';
import { DynamoDBClient, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'jest-aws-client-mock';
import { handler } from '../index.js';
import { handleLoginRequest } from '../loginRequestHandler.js';

const ddbMock = mockClient(DynamoDBClient);
const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
beforeAll(() => {
  if (process.env.VERBOSETESTS != 'True') {
    global.console.error = jest.fn();
    global.console.time = jest.fn();
    global.console.log = jest.fn();
  }

  // Set env variables
  process.env.SESSION_TABLE = 'mijnuitkering-sessions';
  process.env.AUTH_URL_BASE = 'https://authenticatie-accp.nijmegen.nl';
  process.env.APPLICATION_URL_BASE = 'https://testing.example.com/';
  process.env.OIDC_SECRET_ARN = '123';
  process.env.OIDC_CLIENT_ID = '1234';
  process.env.OIDC_SCOPE = 'openid';
});


beforeEach(() => {
  ddbMock.mockReset();
});


test('index is ok', async () => {
  const result = await handler({}, {});
  expect(result.statusCode).toBe(200);
});


test('Return login page with correct link', async () => {
  const result = await handleLoginRequest('', dynamoDBClient);
  expect(result.body).toMatch(`${process.env.AUTH_URL_BASE}/broker/sp/oidc/authenticate`);
  expect(result.body).toMatch(encodeURIComponent(`${process.env.APPLICATION_URL_BASE}auth`));
  expect(result.statusCode).toBe(200);
  writeFile(path.join(__dirname, 'output', 'test.html'), result.body, () => { });
});

test('No redirect if session cookie doesn\'t exist', async () => {

  const result = await handleLoginRequest('demo=12345', dynamoDBClient);
  expect(result.statusCode).toBe(200);
});

test('Create session if no session exists', async () => {

  await handleLoginRequest('', dynamoDBClient);

  expect(ddbMock).toHaveBeenCalledTimes(1);
});

test('Redirect to home if already logged in', async () => {
  const output: Partial<GetItemCommandOutput> = {
    Item: {
      data: {
        M: {
          loggedin: {
            BOOL: true,
          },
        },
      },
    },
  };
  ddbMock.mockImplementation(() => output);
  const sessionId = '12345';
  const result = await handleLoginRequest(`session=${sessionId}`, dynamoDBClient);
  expect(result.headers.Location).toBe('/');
  expect(result.statusCode).toBe(302);
});

test('Unknown session returns login page', async () => {
  const output: Partial<GetItemCommandOutput> = {}; //empty output
  ddbMock.mockImplementation(() => output);
  const sessionId = '12345';
  const result = await handleLoginRequest(`session=${sessionId}`, dynamoDBClient);
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
  const result = await handleLoginRequest(`session=${sessionId}`, dynamoDBClient);
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
  const result = await handleLoginRequest('', dynamoDBClient);
  expect(result.cookies).toEqual(
    expect.arrayContaining([expect.stringMatching('session=')]),
  );
});

test('DynamoDB error', async () => {
  ddbMock.mockImplementation(() => { throw new Error('Not supported!'); });
  let failed = false;
  try {
    await handleLoginRequest('session=12345', dynamoDBClient);
  } catch (error) {
    failed = true;
  }
  expect(ddbMock).toHaveBeenCalledTimes(1);
  expect(failed).toBe(true);
});