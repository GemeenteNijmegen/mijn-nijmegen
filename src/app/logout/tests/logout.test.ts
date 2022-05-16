import { writeFile } from 'fs';
import * as path from 'path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { handleLogoutRequest } from '../handleLogoutRequest';

const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });

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
  process.env.OIDC_SECRET_ARN = '123';
  process.env.OIDC_CLIENT_ID = '1234';
  process.env.OIDC_SCOPE = 'openid';
});


beforeEach(() => {
});

test('Return logout page', async () => {
  const result = await handleLogoutRequest('', dynamoDBClient);
  expect(result.body).toMatch('Uitgelogd');
  expect(result.statusCode).toBe(200);
  writeFile(path.join(__dirname, 'output', 'test.html'), result.body, () => {});
});

test('Return empty session cookie', async () => {
  const result = await handleLogoutRequest('', dynamoDBClient);
  let cookies = result.cookies.filter((cookie: string) => cookie.indexOf('sessionid=;'));
  expect(cookies.length).toBe(1);
  expect(result.statusCode).toBe(200);
});