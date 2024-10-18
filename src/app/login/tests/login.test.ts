import * as fs from 'fs';
import * as path from 'path';
import { DynamoDBClient, GetItemCommandOutput, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { LoginRequestHandler } from '../loginRequestHandler';

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

  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
});


beforeEach(() => {
  ddbMock.reset();
});

describe('Test login page and urls', () => {
  test('Return login page with correct link', async () => {
    const loginRequestHandler = new LoginRequestHandler({
      digidScope: 'idp_scoping:digid',
      oidcScope: 'openid',
    });
    const result = await loginRequestHandler.handleRequest(requestParams(''), dynamoDBClient);
    expect(result.body).toMatch('/login?method=digid');
    expect(result.statusCode).toBe(200);
  });

  test('Return login page with yivi link', async () => {
    const loginRequestHandler = new LoginRequestHandler({
      digidScope: 'idp_scoping:digid',
      oidcScope: 'openid',
      yiviScope: 'idp_scoping:yivi',
      yiviBsnAttribute: 'bsn',
    });
    const redirect = await loginRequestHandler.handleRequest(requestParams('', 'yivi'), dynamoDBClient);
    expect(redirect.headers?.Location).toMatch(encodeURIComponent('idp_scoping:yivi'));
    expect(redirect.headers?.Location).toMatch(encodeURIComponent('bsn'));
    const result = await loginRequestHandler.handleRequest(requestParams(''), dynamoDBClient);
    expect(result.body).toMatch('<span class="title"> Inloggen </span><span class="assistive">met Yivi</span>');
    if (result.body) {
      fs.writeFile(path.join(__dirname, 'output', 'test.html'), result.body.replace( new RegExp('href="/static', 'g'), 'href="../../../static-resources/static'), () => {});
    }
  });

  test('Return auth url with yivi link (conditional disclosure)', async () => {
    const loginRequestHandler = new LoginRequestHandler({
      digidScope: 'idp_scoping:digid',
      oidcScope: 'openid',
      yiviScope: 'idp_scoping:yivi',
      yiviCondisconScope: 'condiscon',
      useYiviKvk: true,
    });
    const redirect = await loginRequestHandler.handleRequest(requestParams('', 'yivi'), dynamoDBClient);
    expect(redirect.headers?.Location).toMatch(encodeURIComponent('idp_scoping:yivi'));
    expect(redirect.headers?.Location).toMatch('condiscon');
    const result = await loginRequestHandler.handleRequest(requestParams(''), dynamoDBClient);
    expect(result.body).toMatch('<span class="title"> Inloggen </span><span class="assistive">met Yivi</span>');
    if (result.body) {
      fs.writeFile(path.join(__dirname, 'output', 'test.html'), result.body.replace( new RegExp('href="/static', 'g'), 'href="../../../static-resources/static'), () => {});
    }
  });

  test('Return login page without yivi link', async () => {
    const loginRequestHandler = new LoginRequestHandler({
      digidScope: 'idp_scoping:digid',
      oidcScope: 'openid',
    });
    const result = await loginRequestHandler.handleRequest(requestParams(''), dynamoDBClient);
    expect(result.body).not.toMatch(('method=yivi'));
  });

  test('Return auth url with digid loa high', async () => {
    const loginRequestHandler = new LoginRequestHandler({
      digidScope: 'idp_scoping:digid service:DigiD_Hoog',
      oidcScope: 'openid',
      yiviScope: 'idp_scoping:yivi',
    });
    const result = await loginRequestHandler.handleRequest(requestParams('', 'digid'), dynamoDBClient);
    expect(JSON.stringify(result.headers)).toMatch(encodeURIComponent('service:DigiD_Hoog'));
  });

  test('Return auth url with digid loa mid', async () => {
    const loginRequestHandler = new LoginRequestHandler({
      digidScope: 'idp_scoping:digid service:DigiD_Midden',
      oidcScope: 'openid',
      yiviScope: 'idp_scoping:yivi',
    });
    const result = await loginRequestHandler.handleRequest(requestParams('', 'digid'), dynamoDBClient);
    expect(JSON.stringify(result.headers)).toMatch(encodeURIComponent('service:DigiD_Midden'));
    expect(JSON.stringify(result.headers)).not.toMatch(encodeURIComponent('service:DigiD_Hoog'));
  });

  test('Return login page with eherkenning link', async () => {
    const loginRequestHandler = new LoginRequestHandler({
      digidScope: 'idp_scoping:digid',
      oidcScope: 'openid',
      yiviScope: 'idp_scoping:yivi',
      eHerkenningScope: 'idp_scoping:eherkenning',
    });
    const result = await loginRequestHandler.handleRequest(requestParams(''), dynamoDBClient);
    expect(result.body).toMatch(('/login?method=eherkenning'));
    expect(result.body).toMatch('<span class="title"> Inloggen </span><span class="assistive">met eHerkenning</span>');
    if (result.body) {
      fs.writeFile(path.join(__dirname, 'output', 'test.html'), result.body.replace( new RegExp('href="/static', 'g'), 'href="../../../static-resources/static'), () => {});
    }
  });
});

test('No redirect if session cookie doesn\'t exist', async () => {
  const loginRequestHandler = new LoginRequestHandler({
    digidScope: 'idp_scoping:digid',
    oidcScope: 'openid',
  });
  const result = await loginRequestHandler.handleRequest(requestParams('demo=12345'), dynamoDBClient);
  expect(result.statusCode).toBe(200);
});

test('Do not create session if no session exists and not started authentication', async () => {
  const loginRequestHandler = new LoginRequestHandler({
    digidScope: 'idp_scoping:digid service: DigiD_Midden',
    oidcScope: 'openid',
  });
  const resp = await loginRequestHandler.handleRequest(requestParams(''), dynamoDBClient);
  expect(ddbMock.calls().length).toBe(0);
  expect(resp.cookies).toBeUndefined();
});

test('Create session if no session exists when starting authentication', async () => {
  const loginRequestHandler = new LoginRequestHandler({
    digidScope: 'idp_scoping:digid service: DigiD_Midden',
    oidcScope: 'openid',
  });
  const resp = await loginRequestHandler.handleRequest(requestParams('', 'digid'), dynamoDBClient);
  expect(ddbMock.calls().length).toBe(1);
  expect(resp.cookies).not.toBeUndefined();
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
  const loginRequestHandler = new LoginRequestHandler({
    digidScope: 'idp_scoping:digid',
    oidcScope: 'openid',
  });
  const result = await loginRequestHandler.handleRequest(requestParams(`session=${sessionId}`), dynamoDBClient);
  expect(result?.headers?.Location).toBe('/');
  expect(result.statusCode).toBe(302);
});

test('Unknown session returns login page', async () => {
  const output: Partial<GetItemCommandOutput> = {}; //empty output
  ddbMock.on(GetItemCommand).resolves(output);
  const sessionId = '12345';
  const loginRequestHandler = new LoginRequestHandler({
    digidScope: 'idp_scoping:digid',
    oidcScope: 'openid',
  });
  const result = await loginRequestHandler.handleRequest(requestParams(`session=${sessionId}`), dynamoDBClient);
  expect(ddbMock.calls().length).toBe(1);
  expect(result.statusCode).toBe(200);
});

test('Render page when no method is set', async () => {
  const loginRequestHandler = new LoginRequestHandler({
    digidScope: 'idp_scoping:digid',
    oidcScope: 'openid',
  });
  const result = await loginRequestHandler.handleRequest(requestParams('session=123'), dynamoDBClient);
  expect(result.body).toMatch('<!doctype html>');
});

test('Do redirect when method is set', async () => {
  const loginRequestHandler = new LoginRequestHandler({
    digidScope: 'idp_scoping:digid',
    oidcScope: 'openid',
  });
  const result = await loginRequestHandler.handleRequest(requestParams('session=123', 'digid'), dynamoDBClient);
  expect(result.statusCode).toBe(302);
  expect(result.headers?.Location).toMatch(encodeURIComponent('idp_scoping:digid'));
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
  const loginRequestHandler = new LoginRequestHandler({
    digidScope: 'idp_scoping:digid',
    oidcScope: 'openid',
  });
  const result = await loginRequestHandler.handleRequest(requestParams(`session=${sessionId}`), dynamoDBClient);
  expect(ddbMock.calls().length).toBe(1);
  expect(result.statusCode).toBe(200);
});

test('Request without session does not return session cookie if no authentication is started', async () => {
  const loginRequestHandler = new LoginRequestHandler({
    digidScope: 'idp_scoping:digid',
    oidcScope: 'openid',
  });
  const result = await loginRequestHandler.handleRequest(requestParams(''), dynamoDBClient);
  expect(result.cookies).not.toEqual(
    expect.arrayContaining([expect.stringMatching('session=')]),
  );
});

test('Request without session returns session cookie whem authentication is started', async () => {
  const loginRequestHandler = new LoginRequestHandler({
    digidScope: 'idp_scoping:digid',
    oidcScope: 'openid',
  });
  const result = await loginRequestHandler.handleRequest(requestParams('', 'digid'), dynamoDBClient);
  expect(result.cookies).toEqual(
    expect.arrayContaining([expect.stringMatching('session=')]),
  );
});

test('DynamoDB error', async () => {
  ddbMock.on(GetItemCommand).rejects(new Error('Not supported!'));
  let failed = false;
  try {
    const loginRequestHandler = new LoginRequestHandler({
      digidScope: 'idp_scoping:digid service: DigiD_Midden',
      oidcScope: 'openid',
    });
    await loginRequestHandler.handleRequest(requestParams('session=12345'), dynamoDBClient);
  } catch (error) {
    failed = true;
  }
  expect(ddbMock.calls().length).toBe(1);
  expect(failed).toBe(true);
});

function requestParams(cookies: string, method?: string) {
  return {
    cookies: cookies,
    nlwallet: false,
    method: method,
  };
}