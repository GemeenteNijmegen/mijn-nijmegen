import { writeFile } from 'fs';
import * as path from 'path';
import { DynamoDBClient, GetItemCommandOutput, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { DigidServiceLevel, LoginRequestHandler } from '../loginRequestHandler';

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
  ddbMock.reset();
});

describe('Test login page and urls', () => {
  test('Return login page with correct link', async () => {
    const loginRequestHandler = new LoginRequestHandler({});
    const result = await loginRequestHandler.handleRequest('', dynamoDBClient);
    expect(result.body).toMatch(`${process.env.AUTH_URL_BASE}/broker/sp/oidc/authenticate`);
    expect(result.body).toMatch(encodeURIComponent(`${process.env.APPLICATION_URL_BASE}auth`));
    expect(result.body).toMatch(encodeURIComponent('idp_scoping:digid'));
    expect(result.statusCode).toBe(200);
    if (result.body) {
      writeFile(path.join(__dirname, 'output', 'test.html'), result.body, () => { });
    }
  });

  test('Return login page with yivi link', async () => {
    const loginRequestHandler = new LoginRequestHandler({
      useYivi: true,
    });
    const result = await loginRequestHandler.handleRequest('', dynamoDBClient);
    expect(result.body).toMatch(encodeURIComponent('idp_scoping:yivi'));
    expect(result.body).toMatch('<span class="title"> Inloggen </span><span class="assistive">met Yivi</span>');
  });

  test('Return login page without yivi link', async () => {
    const loginRequestHandler = new LoginRequestHandler({});
    const result = await loginRequestHandler.handleRequest('', dynamoDBClient);
    expect(result.body).not.toMatch(encodeURIComponent('idp_scoping:yivi'));
  });

  test('Return login page with digid loa high', async () => {
    const loginRequestHandler = new LoginRequestHandler({
      digidServiceLevel: DigidServiceLevel.DigiD_Hoog,
    });
    const result = await loginRequestHandler.handleRequest('', dynamoDBClient);
    expect(result.body).toMatch(encodeURIComponent('service:DigiD_Hoog'));
  });

  test('Return login page with digid loa mid', async () => {
    const loginRequestHandler = new LoginRequestHandler({
      digidServiceLevel: DigidServiceLevel.DigiD_Midden,
    });
    const result = await loginRequestHandler.handleRequest('', dynamoDBClient);
    expect(result.body).toMatch(encodeURIComponent('service:DigiD_Midden'));
    expect(result.body).not.toMatch(encodeURIComponent('service:DigiD_Hoog'));
  });
});

test('No redirect if session cookie doesn\'t exist', async () => {
  const loginRequestHandler = new LoginRequestHandler({});
  const result = await loginRequestHandler.handleRequest('demo=12345', dynamoDBClient);
  expect(result.statusCode).toBe(200);
});

test('Create session if no session exists', async () => {
  const loginRequestHandler = new LoginRequestHandler({});
  await loginRequestHandler.handleRequest('', dynamoDBClient);

  expect(ddbMock.calls().length).toBe(1);
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
  ddbMock.on(GetItemCommand).resolves(output);
  const sessionId = '12345';
  const loginRequestHandler = new LoginRequestHandler({});
  const result = await loginRequestHandler.handleRequest(`session=${sessionId}`, dynamoDBClient);
  expect(result?.headers?.Location).toBe('/');
  expect(result.statusCode).toBe(302);
});

test('Unknown session returns login page', async () => {
  const output: Partial<GetItemCommandOutput> = {}; //empty output
  ddbMock.on(GetItemCommand).resolves(output);
  const sessionId = '12345';
  const loginRequestHandler = new LoginRequestHandler({});
  const result = await loginRequestHandler.handleRequest(`session=${sessionId}`, dynamoDBClient);
  expect(ddbMock.calls().length).toBe(2);
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
  ddbMock.on(GetItemCommand).resolves(output);
  const sessionId = '12345';
  const loginRequestHandler = new LoginRequestHandler({});
  const result = await loginRequestHandler.handleRequest(`session=${sessionId}`, dynamoDBClient);
  expect(ddbMock.calls().length).toBe(2);
  expect(result.statusCode).toBe(200);
});

test('Request without session returns session cookie', async () => {
  const loginRequestHandler = new LoginRequestHandler({});
  const result = await loginRequestHandler.handleRequest('', dynamoDBClient);
  expect(result.cookies).toEqual(
    expect.arrayContaining([expect.stringMatching('session=')]),
  );
});

test('DynamoDB error', async () => {
  ddbMock.on(GetItemCommand).rejects(new Error('Not supported!'));
  let failed = false;
  try {
    const loginRequestHandler = new LoginRequestHandler({});
    await loginRequestHandler.handleRequest('session=12345', dynamoDBClient);
  } catch (error) {
    failed = true;
  }
  expect(ddbMock.calls().length).toBe(1);
  expect(failed).toBe(true);
});