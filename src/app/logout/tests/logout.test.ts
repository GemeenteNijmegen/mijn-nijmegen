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


beforeEach(() => {
});

test('Return login page with correct link', async () => {
  const result = await lambda.handler({}, {});
  expect(result.body).toMatch('Uitgelogd');
  expect(result.statusCode).toBe(200);
});

test('Return empty session cookie', async () => {
  const result = await lambda.handler({}, {});
  let cookies = result.cookies.filter((cookie: string) => cookie.indexOf('sessionid=;'));
  expect(cookies.length).toBe(1);
  expect(result.statusCode).toBe(200);
});