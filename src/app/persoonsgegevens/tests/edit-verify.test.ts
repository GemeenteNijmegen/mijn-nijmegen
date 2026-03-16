import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { ApiClient } from '../../../shared/ApiClient';
import { HaalCentraalApi } from '../../../shared/HaalCentraalApi';
import { OpenKlantApi } from '../../../shared/OpenKlantApi';
import { PersoonsgegevensRequestHandler } from '../persoonsgegevensRequestHandler';

const ddbMock = mockClient(DynamoDBClient);
const sessionId = '12345';

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
      verification_expiry_email: { N: (Date.now() + 900000).toString() },
      verification_attempts_email: { N: '3' },
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
    expect(result.body).toContain('3 poging(en)');
  });

  xtest('POST /persoonsgegevens/verify with correct code updates contact info', async () => {
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
            verification_expiry_email: { N: futureTime },
            verification_attempts_email: { N: '3' },
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

  xtest('POST /persoonsgegevens/verify shows error when OpenKlant API fails', async () => {
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
            verification_expiry_email: { N: futureTime },
            verification_attempts_email: { N: '3' },
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

  xtest('POST /persoonsgegevens/verify with wrong code decrements attempts', async () => {
    const futureTime = String(Date.now() + 10000000);
    let callCount = 0;
    ddbMock.on(GetItemCommand).callsFake(() => {
      callCount++;
      return {
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
              verification_expiry_email: { N: futureTime },
              verification_attempts_email: { N: callCount === 1 ? '3' : '2' },
            },
          },
        },
      };
    });

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
    expect(result.body).toContain('2 poging(en)');
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
      cookies: `session=${sessionId}`,
      method: 'POST',
      body: { type: 'email', code: '123456', xsrf_token: 'test-token' },
      path: '/persoonsgegevens/verify',
      queryStringParameters: {},
    });

    expect(result.statusCode).toBe(302);
    expect(result.headers?.Location).toBe('/persoonsgegevens/edit?type=email');
  });

  xtest('POST /persoonsgegevens/verify with no attempts left redirects to persoonsgegevens', async () => {
    const futureTime = String(Date.now() + 10000000);
    setupSession({
      loggedin: { BOOL: true },
      identifier: { S: '900222670' },
      user_type: { S: 'person' },
      username: { S: 'Test User' },
      xsrf_token: { S: 'test-token' },
      pending_email: { S: 'new@example.com' },
      verification_code_email: { S: '123456' },
      verification_expiry_email: { N: futureTime },
      verification_attempts_email: { N: '0' },
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
    expect(result.headers?.Location).toBe('/persoonsgegevens');
  });
});

describe('OpenKlantApi updateContactInfo', () => {
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
      { adres: 'test@example.com', soortDigitaalAdres: 'email', verstrektDoorPartij: { uuid: 'test-uuid' }, verstrektDoorBetrokkene: null },
      { 'Content-Type': 'application/json' },
    );
    expect(mockApiClient.putData).toHaveBeenCalledWith(
      'https://example.com/klantinteracties/api/v1/digitaleadressen/phone-uuid',
      { adres: '0612345678', soortDigitaalAdres: 'telefoonnummer', verstrektDoorPartij: { uuid: 'test-uuid' }, verstrektDoorBetrokkene: null },
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
        partijIdentificator: { objectId: '900222670', codeSoortObjectId: 'bsn' },
      },
      { 'Content-Type': 'application/json' },
    );
    expect(mockApiClient.postData).toHaveBeenCalledWith(
      'https://example.com/klantinteracties/api/v1/digitaleadressen',
      { adres: 'test@example.com', soortDigitaalAdres: 'email', verstrektDoorPartij: { uuid: 'new-partij-uuid' }, verstrektDoorBetrokkene: null },
      { 'Content-Type': 'application/json' },
    );
  });
});
