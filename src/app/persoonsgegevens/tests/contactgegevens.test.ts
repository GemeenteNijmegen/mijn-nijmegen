import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { ApiClient } from '../../../shared/ApiClient';
import { HaalCentraalApi } from '../../../shared/HaalCentraalApi';
import { PersoonsgegevensRequestHandler } from '../persoonsgegevensRequestHandler';

const ddbMock = mockClient(DynamoDBClient);

beforeEach(() => {
  ddbMock.reset();
});

function setupSession(data: any) {
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      data: { M: data },
    },
  };
  ddbMock.on(GetItemCommand).resolves(getItemOutput);
}

describe('Persoonsgegevens Edit Contactgegevens', () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const apiClient = new ApiClient({});
  const haalCentraalApi = new HaalCentraalApi({ baseUrl: 'https://localhost', apiclient: apiClient });

  test('GET /persoonsgegevens/edit shows edit form for email', async () => {
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
      email: { S: 'old@example.com' },
    });

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: 'session=12345',
      method: 'GET',
      body: {},
      path: '/persoonsgegevens/edit',
      queryStringParameters: { type: 'email' },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('E-mailadres aanpassen');
  });

  test('POST /persoonsgegevens/edit generates verification code', async () => {
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
    });

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: 'session=12345',
      method: 'POST',
      body: { type: 'email', value: 'new@example.com', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/edit',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(302);
    expect(result.headers?.Location).toBe('/persoonsgegevens/verify?type=email');
  });

  test('POST /persoonsgegevens/edit rejects invalid XSRF token', async () => {
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
    });

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: 'session=12345',
      method: 'POST',
      body: { type: 'email', value: 'new@example.com', xsrf_token: 'wrong-token' },
      path: '/persoonsgegevens/edit',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(403);
  });

  test('POST /persoonsgegevens/edit rejects missing value', async () => {
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
    });

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: 'session=12345',
      method: 'POST',
      body: { type: 'email', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/edit',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(400);
  });
});

describe('Persoonsgegevens Verify Contactgegevens', () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const apiClient = new ApiClient({});
  const haalCentraalApi = new HaalCentraalApi({ baseUrl: 'https://localhost', apiclient: apiClient });

  test('GET /persoonsgegevens/verify shows verification form', async () => {
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
      pending_email: { S: 'new@example.com' },
      verification_code_email: { S: '123456' },
      verification_expiry_email: { N: (Date.now() + 900000).toString() },
      verification_attempts_email: { N: '3' },
    });

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: 'session=12345',
      method: 'GET',
      body: {},
      path: '/persoonsgegevens/verify',
      queryStringParameters: { type: 'email' },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('Verificatie');
  });

  test('POST /persoonsgegevens/verify rejects invalid XSRF token', async () => {
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
      pending_email: { S: 'new@example.com' },
    });

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: 'session=12345',
      method: 'POST',
      body: { type: 'email', code: '123456', xsrf_token: 'wrong-token' },
      path: '/persoonsgegevens/verify',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(403);
  });

  test('GET /persoonsgegevens/verify redirects if no pending value', async () => {
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
    });

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: 'session=12345',
      method: 'GET',
      body: {},
      path: '/persoonsgegevens/verify',
      queryStringParameters: { type: 'email' },
    });

    expect(result.statusCode).toBe(302);
    expect(result.headers?.Location).toBe('/persoonsgegevens');
  });

  test('POST /persoonsgegevens/verify with expired code redirects to edit', async () => {
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
      pending_email: { S: 'new@example.com' },
      verification_code_email: { S: '123456' },
      verification_expiry_email: { N: (Date.now() - 1000).toString() },
      verification_attempts_email: { N: '3' },
    });

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: 'session=12345',
      method: 'POST',
      body: { type: 'email', code: '123456', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/verify',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(302);
    expect(result.headers?.Location).toBe('/persoonsgegevens/edit?type=email');
  });
});
