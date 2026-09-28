import { ConditionalCheckFailedException, DynamoDBClient, GetItemCommand, GetItemCommandOutput, UpdateItemCommand, UpdateItemCommandInput } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { ApiClient } from '../../../shared/ApiClient';
import { HaalCentraalApi } from '../../../shared/HaalCentraalApi';
import { OpenKlantApi } from '../../../shared/OpenKlantApi';
import { PersoonsgegevensRequestHandler } from '../persoonsgegevensRequestHandler';

const ddbMock = mockClient(DynamoDBClient);
const sessionId = '12345';

beforeAll(() => {
  process.env.SESSION_TABLE = 'mijnnijmegen-sessions';
});

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

/**
 * By default the mocked DynamoDBClient resolves every UpdateItemCommand,
 * which covers both the session package's own writes and a rate-limiter
 * "allowed" outcome. Call this to make the rate limiter deny requests for
 * a given scope ('issue' or 'verify') while session writes keep succeeding.
 */
function mockRateLimitExceeded(scope: 'issue' | 'verify') {
  ddbMock.on(UpdateItemCommand).callsFake((input: UpdateItemCommandInput) => {
    const key = input.Key?.sessionid?.S ?? '';
    if (key.startsWith(`ratelimit#${scope}#`)) {
      throw new ConditionalCheckFailedException({ message: 'exceeded', $metadata: {} });
    }
    return {};
  });
}

/**
 * Makes the (allowed) verify rate-limit consume report back a specific
 * count, so `attemptsLeft` in the rendered page is deterministic.
 */
function mockVerifyCountAfterConsume(count: number) {
  ddbMock.on(UpdateItemCommand).callsFake((input: UpdateItemCommandInput) => {
    const key = input.Key?.sessionid?.S ?? '';
    if (key.startsWith('ratelimit#verify#')) {
      return { Attributes: { count: { N: String(count) } } };
    }
    return {};
  });
}

describe('Persoonsgegevens Edit Functionality', () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const apiClient = new ApiClient({});
  const haalCentraalApi = new HaalCentraalApi({ baseUrl: 'https://localhost', apiclient: apiClient });

  test('GET /persoonsgegevens/edit shows edit form', async () => {
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
      cookies: `session=${sessionId}`,
      method: 'GET',
      body: {},
      path: '/persoonsgegevens/edit',
      queryStringParameters: { type: 'email' },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('E-mailadres aanpassen');
    expect(result.body).toContain('old@example.com');
  });

  test('POST /persoonsgegevens/edit generates verification code and redirects', async () => {
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
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'email', value: 'new@example.com', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/edit',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(302);
    expect(result.headers?.Location).toBe('/persoonsgegevens/verify?type=email');
  });

  test('POST /persoonsgegevens/edit is rate limited after too many code requests', async () => {
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
    });
    mockRateLimitExceeded('issue');

    const mockNotifyNLApi = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
      sendSms: jest.fn().mockResolvedValue(undefined),
    } as any;

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      notifyNLApi: mockNotifyNLApi,
      notifyEmailTemplateId: 'template-id',
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'email', value: 'new@example.com', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/edit',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(429);
    expect(result.body).toContain('te veel verificatiecodes');
    expect(mockNotifyNLApi.sendEmail).not.toHaveBeenCalled();
  });

  test('POST /persoonsgegevens/edit rejects an unknown type', async () => {
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
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'not-a-real-type', value: 'a@b.com', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/edit',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(400);
  });

  test('POST /persoonsgegevens/edit rate limit response includes a Retry-After header and minute-based message', async () => {
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
    });
    mockRateLimitExceeded('issue');

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'email', value: 'new@example.com', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/edit',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(429);
    expect(result.headers?.['Retry-After']).toMatch(/^\d+$/);
    expect(result.body).toMatch(/Probeer het over \d+ minu(ut|ten) opnieuw\./);
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
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'email', value: 'new@example.com', xsrf_token: 'wrong-token' },
      path: '/persoonsgegevens/edit',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(403);
  });
});

describe('Persoonsgegevens Verify Functionality', () => {
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
      verification_expiry_email: { S: (Date.now() + 900000).toString() },
    });

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'GET',
      body: {},
      path: '/persoonsgegevens/verify',
      queryStringParameters: { type: 'email' },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('Verificatie');
    expect(result.body).toContain('new@example.com');
    // No verify attempts consumed yet this window, so no budget shows.
    expect(result.body).not.toContain('5 poging(en)');
  });

  test('POST /persoonsgegevens/verify with correct code updates contact info', async () => {
    const futureTime = String(Date.now() + 10000000);
    ddbMock.on(GetItemCommand).callsFake(() => ({
      Item: {
        data: {
          M: {
            loggedin: { BOOL: true },
            identifier: { S: '900222670' },
            user_type: { S: 'person' },
            username: { S: 'Test User' },
            xsrf_token: { S: 'test-token' },
            pending_email: { S: 'new@example.com' },
            verification_code_email: { S: '123456' },
            verification_expiry_email: { S: futureTime },
          },
        },
      },
    }));

    const mockOpenKlantApi = {
      updateContactInfo: jest.fn().mockResolvedValue(undefined),
    } as any;

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      openKlantApi: mockOpenKlantApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'email', code: '123456', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/verify',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(302);
    expect(result.headers?.Location).toBe('/persoonsgegevens');
    expect(mockOpenKlantApi.updateContactInfo).toHaveBeenCalledWith('900222670', 'person', {
      email: 'new@example.com',
      phonenumber: undefined,
    });
  });

  test('POST /persoonsgegevens/verify shows error when OpenKlant API fails', async () => {
    const futureTime = String(Date.now() + 10000000);
    ddbMock.on(GetItemCommand).callsFake(() => ({
      Item: {
        data: {
          M: {
            loggedin: { BOOL: true },
            identifier: { S: '900222670' },
            user_type: { S: 'person' },
            username: { S: 'Test User' },
            xsrf_token: { S: 'test-token' },
            pending_email: { S: 'new@example.com' },
            verification_code_email: { S: '123456' },
            verification_expiry_email: { S: futureTime },
          },
        },
      },
    }));

    const mockOpenKlantApi = {
      updateContactInfo: jest.fn().mockRejectedValue(new Error('API Error')),
    } as any;

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      openKlantApi: mockOpenKlantApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'email', code: '123456', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/verify',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('Er is iets fout gegaan');
    expect(result.body).toContain('Verificatie');
    expect(mockOpenKlantApi.updateContactInfo).toHaveBeenCalled();
  });

  test('POST /persoonsgegevens/verify with wrong code shows remaining attempts', async () => {
    const futureTime = String(Date.now() + 10000000);
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
      pending_email: { S: 'new@example.com' },
      verification_code_email: { S: '123456' },
      verification_expiry_email: { S: futureTime },
    });
    mockVerifyCountAfterConsume(1);

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'email', code: '999999', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/verify',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('Ongeldige code');
    // 4 attempts left after this wrong guess, so the page should show that.
    expect(result.body).toContain('4 poging(en)');
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
      verification_expiry_email: { S: (Date.now() - 1000).toString() },
    });

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'email', code: '123456', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/verify',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(302);
    expect(result.headers?.Location).toBe('/persoonsgegevens/edit?type=email');
  });

  test('POST /persoonsgegevens/verify with expired code does not consume a verify rate-limit slot', async () => {
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
      pending_email: { S: 'new@example.com' },
      verification_code_email: { S: '123456' },
      verification_expiry_email: { S: (Date.now() - 1000).toString() },
    });

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      contactgegevensLive: true,
    });

    await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'email', code: '123456', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/verify',
      queryStringParameters: {},
    });

    const verifyRateLimitCalls = ddbMock.commandCalls(UpdateItemCommand).filter(
      (call) => (call.args[0].input.Key?.sessionid?.S ?? '').startsWith('ratelimit#verify#'),
    );
    expect(verifyRateLimitCalls).toHaveLength(0);
  });

  test('POST /persoonsgegevens/verify rejects an unknown type', async () => {
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
      pending_not_a_real_type: { S: 'new@example.com' },
    });

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'not-a-real-type', code: '123456', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/verify',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(400);
  });

  test('POST /persoonsgegevens/verify with correct code shows an error instead of silently succeeding when OpenKlant is not configured', async () => {
    const futureTime = String(Date.now() + 10000000);
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
      pending_email: { S: 'new@example.com' },
      verification_code_email: { S: '123456' },
      verification_expiry_email: { S: futureTime },
    });

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      // openKlantApi intentionally omitted
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'email', code: '123456', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/verify',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('Er is iets fout gegaan');
    expect(result.body).toContain('Verificatie');
  });

  test('POST /persoonsgegevens/verify rate limit response includes a Retry-After header and minute-based message', async () => {
    const futureTime = String(Date.now() + 10000000);
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
      pending_email: { S: 'new@example.com' },
      verification_code_email: { S: '123456' },
      verification_expiry_email: { S: futureTime },
    });
    mockRateLimitExceeded('verify');

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'email', code: '123456', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/verify',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(429);
    expect(result.headers?.['Retry-After']).toMatch(/^\d+$/);
    expect(result.body).toMatch(/Probeer het over \d+ minu(ut|ten) opnieuw\./);
  });

  test('POST /persoonsgegevens/verify is rate limited even with a correct code', async () => {
    const futureTime = String(Date.now() + 10000000);
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
      pending_email: { S: 'new@example.com' },
      verification_code_email: { S: '123456' },
      verification_expiry_email: { S: futureTime },
    });
    mockRateLimitExceeded('verify');

    const mockOpenKlantApi = {
      updateContactInfo: jest.fn(),
    } as any;

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      openKlantApi: mockOpenKlantApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'email', code: '123456', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/verify',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(429);
    expect(result.body).toContain('te veel pogingen');
    // The gate runs before the code comparison, so a correct code must not be processed.
    expect(mockOpenKlantApi.updateContactInfo).not.toHaveBeenCalled();
  });

  test('a freshly requested code does not reset an already-exhausted verify rate limit', async () => {
    // This simulates an already-exhausted account-level verify limit for
    // this session/type. Requesting a brand-new code (issue scope, which
    // is independent and not exhausted) must not clear that state, so the
    // subsequent verify attempt with the new code must still be blocked.
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
    });
    mockRateLimitExceeded('verify');

    const mockNotifyNLApi = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
      sendSms: jest.fn().mockResolvedValue(undefined),
    } as any;

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      notifyNLApi: mockNotifyNLApi,
      notifyEmailTemplateId: 'template-id',
      contactgegevensLive: true,
    });

    const editResult = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'email', value: 'new@example.com', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/edit',
      queryStringParameters: {},
    });

    // Issuing a fresh code succeeds, since the issue and verify scopes are independent.
    expect(editResult.statusCode).toBe(302);
    expect(mockNotifyNLApi.sendEmail).toHaveBeenCalled();

    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
      pending_email: { S: 'new@example.com' },
      verification_code_email: { S: '123456' },
      verification_expiry_email: { S: (Date.now() + 900000).toString() },
    });

    const verifyResult = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'email', code: '123456', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/verify',
      queryStringParameters: {},
    });

    expect(verifyResult.statusCode).toBe(429);
    expect(verifyResult.body).toContain('te veel pogingen');
  });

  test('POST /persoonsgegevens/verify with wrong code that exhausts the last attempt keeps showing too many attempts message', async () => {
    const futureTime = String(Date.now() + 10000000);
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
      pending_email: { S: 'new@example.com' },
      verification_code_email: { S: '123456' },
      verification_expiry_email: { S: futureTime },
    });
    // This attempt is allowed (it's the 5th of 5 in the window), but uses up
    // the last slot, so a wrong guess here should give an indicator to cancel and retry later.
    mockVerifyCountAfterConsume(5);

    const handler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      contactgegevensLive: true,
    });

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'email', code: '999999', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/verify',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(429);
    expect(result.body).toContain('te veel pogingen');
  });
});

/**
 * Pulls the rendered breadcrumb trail out of a page: the crumb titles in
 * order, the crumb marked as current page and the mobile "back" link.
 */
function parseBreadcrumbs(html: string) {
  const nav = html.match(/<nav aria-label="Broodkruimelnavigatie"[\s\S]*?<\/nav>/)?.[0] ?? '';
  const list = nav.slice(nav.indexOf('<ol'));
  const decode = (value: string) => value.replace(/&#x2F;/g, '/').replace(/&#x3D;/g, '=');
  return {
    trail: [...list.matchAll(/nijmegen-breadcrumb__text">([^<]*)</g)].map(match => match[1]),
    current: list.match(/aria-current="page"[^>]*>\s*<span[^>]*>([^<]*)</)?.[1],
    back: decode(nav.match(/nijmegen-breadcrumb__link--mobile" href="([^"]*)"/)?.[1] ?? ''),
  };
}

describe('Persoonsgegevens breadcrumbs', () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const apiClient = new ApiClient({});
  const haalCentraalApi = new HaalCentraalApi({ baseUrl: 'https://localhost', apiclient: apiClient });
  const handler = new PersoonsgegevensRequestHandler({
    dynamoDBClient,
    haalCentraalApi,
    contactgegevensLive: true,
  });

  const session = {
    loggedin: { BOOL: true },
    identifier: { S: '900222670' },
    user_type: { S: 'person' },
    username: { S: 'Test User' },
    xsrf_token: { S: 'test-token' },
    email: { S: 'old@example.com' },
    pending_email: { S: 'new@example.com' },
    pending_phonenumber: { S: '0612345678' },
    verification_expiry_email: { S: (Date.now() + 900000).toString() },
    verification_expiry_phonenumber: { S: (Date.now() + 900000).toString() },
  };

  test('overview page shows Mijn gegevens as current page', async () => {
    setupSession(session);
    jest.spyOn(haalCentraalApi, 'getBrpData').mockRejectedValueOnce(new Error('not needed for this test'));

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'GET',
      body: {},
      path: '/persoonsgegevens',
      queryStringParameters: {},
    });

    expect(parseBreadcrumbs(result.body as string)).toEqual({
      trail: ['Home', 'Mijn gegevens'],
      current: 'Mijn gegevens',
      back: '/',
    });
  });

  test.each([
    ['email', 'E-mailadres aanpassen'],
    ['phonenumber', 'Telefoonnummer aanpassen'],
  ])('edit page for %s adds itself as current page', async (type, title) => {
    setupSession(session);

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'GET',
      body: {},
      path: '/persoonsgegevens/edit',
      queryStringParameters: { type },
    });

    expect(parseBreadcrumbs(result.body as string)).toEqual({
      trail: ['Home', 'Mijn gegevens', title],
      current: title,
      back: '/persoonsgegevens',
    });
  });

  test('edit page keeps its breadcrumbs when showing a validation error', async () => {
    setupSession(session);

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { xsrf_token: 'test-token', type: 'email', value: 'not-an-email' },
      path: '/persoonsgegevens/edit',
      queryStringParameters: {},
    });

    expect(result.body).toContain('Vul een geldig e-mailadres in');
    expect(parseBreadcrumbs(result.body as string)).toEqual({
      trail: ['Home', 'Mijn gegevens', 'E-mailadres aanpassen'],
      current: 'E-mailadres aanpassen',
      back: '/persoonsgegevens',
    });
  });

  test.each([
    ['email', 'E-mailadres aanpassen'],
    ['phonenumber', 'Telefoonnummer aanpassen'],
  ])('verify page for %s links back to the matching edit page', async (type, editTitle) => {
    setupSession(session);

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'GET',
      body: {},
      path: '/persoonsgegevens/verify',
      queryStringParameters: { type },
    });

    expect(parseBreadcrumbs(result.body as string)).toEqual({
      trail: ['Home', 'Mijn gegevens', editTitle, 'Verificatie'],
      current: 'Verificatie',
      back: `/persoonsgegevens/edit?type=${type}`,
    });
  });

  test('verify page keeps its breadcrumbs when showing a wrong code error', async () => {
    setupSession({ ...session, verification_code_email: { S: '123456' } });
    mockVerifyCountAfterConsume(1);

    const result = await handler.handleRequest({
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { xsrf_token: 'test-token', type: 'email', code: '000000' },
      path: '/persoonsgegevens/verify',
      queryStringParameters: {},
    });

    expect(result.body).toContain('Ongeldige code');
    expect(parseBreadcrumbs(result.body as string).current).toBe('Verificatie');
  });
});

describe('OpenKlantApi updateContactInfo', () => {
  const fixedDate = '2024-01-15';

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('Updates contact info successfully', async () => {
    const mockApiClient = {
      getData: jest.fn().mockResolvedValue({
        count: 1,
        results: [{
          uuid: 'test-uuid',
          _expand: {
            digitaleAdressen: [
              { uuid: 'email-uuid', url: 'https://example.com/email', adres: 'old@example.com', soortDigitaalAdres: 'email', verstrektDoorPartij: { uuid: 'test-uuid', url: 'https://example.com/partij' } },
              { uuid: 'phone-uuid', url: 'https://example.com/phone', adres: '0611111111', soortDigitaalAdres: 'telefoonnummer', verstrektDoorPartij: { uuid: 'test-uuid', url: 'https://example.com/partij' } },
            ],
          },
        }],
      }),
      postData: jest.fn().mockResolvedValue({}),
      putData: jest.fn().mockResolvedValue({}),
    } as any;

    const openKlantApi = new OpenKlantApi({
      baseUrl: 'https://example.com',
      apiclient: mockApiClient,
    });

    await openKlantApi.updateContactInfo('900222670', 'person', {
      email: 'test@example.com',
      phonenumber: '0612345678',
    });

    expect(mockApiClient.getData).toHaveBeenCalled();
    expect(mockApiClient.putData).toHaveBeenCalledWith(
      'https://example.com/klantinteracties/api/v1/digitaleadressen/email-uuid',
      { adres: 'test@example.com', soortDigitaalAdres: 'email', verstrektDoorPartij: { uuid: 'test-uuid' }, verstrektDoorBetrokkene: null, isStandaardAdres: true, verificatieDatum: fixedDate },
      { 'Content-Type': 'application/json' },
    );
    expect(mockApiClient.putData).toHaveBeenCalledWith(
      'https://example.com/klantinteracties/api/v1/digitaleadressen/phone-uuid',
      { adres: '0612345678', soortDigitaalAdres: 'telefoonnummer', verstrektDoorPartij: { uuid: 'test-uuid' }, verstrektDoorBetrokkene: null, isStandaardAdres: true, verificatieDatum: fixedDate },
      { 'Content-Type': 'application/json' },
    );
  });

  test('Creates partij when not found', async () => {
    const mockApiClient = {
      getData: jest.fn().mockResolvedValue({
        count: 0,
        results: [],
      }),
      postData: jest.fn().mockResolvedValue({ uuid: 'new-partij-uuid' }),
    } as any;

    const openKlantApi = new OpenKlantApi({
      baseUrl: 'https://example.com',
      apiclient: mockApiClient,
    });

    await openKlantApi.updateContactInfo('900222670', 'person', { email: 'test@example.com' });

    expect(mockApiClient.postData).toHaveBeenCalledWith(
      'https://example.com/klantinteracties/api/v1/partijen',
      {
        soortPartij: 'persoon',
        indicatieActief: true,
        digitaleAdressen: [],
        voorkeursDigitaalAdres: null,
        rekeningnummers: [],
        voorkeursRekeningnummer: null,
        partijIdentificatie: {
          contactnaam: null,
        },
      },
      { 'Content-Type': 'application/json' },
    );
    expect(mockApiClient.postData).toHaveBeenCalledWith(
      'https://example.com/klantinteracties/api/v1/partij-identificatoren',
      {
        identificeerdePartij: { uuid: 'new-partij-uuid' },
        partijIdentificator: { objectId: '900222670', codeSoortObjectId: 'bsn', codeRegister: 'brp', codeObjecttype: 'natuurlijk_persoon' },
      },
      { 'Content-Type': 'application/json' },
    );
    expect(mockApiClient.postData).toHaveBeenCalledWith(
      'https://example.com/klantinteracties/api/v1/digitaleadressen',
      { adres: 'test@example.com', soortDigitaalAdres: 'email', verstrektDoorPartij: { uuid: 'new-partij-uuid' }, verstrektDoorBetrokkene: null, isStandaardAdres: true, verificatieDatum: fixedDate },
      { 'Content-Type': 'application/json' },
    );
  });
});
