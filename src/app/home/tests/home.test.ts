import * as fs from 'fs';
import path from 'path';
import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { GetSecretValueCommand, GetSecretValueCommandOutput, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import { ZaakSummary } from '../../zaken/ZaakInterface';
import { HomeRequestHandler } from '../homeRequestHandler';

beforeAll(() => {

  if (process.env.VERBOSETESTS != 'True') {
    global.console.error = jest.fn();
    global.console.time = jest.fn();
    global.console.log = jest.fn();
  }
  // Set env variables
  process.env.SESSION_TABLE = 'mijnuitkering-sessions';
  process.env.APPLICATION_URL_BASE = 'https://testing.example.com/';
  process.env.ZAKEN_APIGATEWAY_BASEURL = 'https://localhost';
  process.env.ZAKEN_APIGATEWAY_APIKEY = 'test';

  const sampleDate = new Date();
  const mockedZakenList: ZaakSummary[] = [
    {
      identifier: '123',
      internal_id: 'zaak/hiereenuuid',
      registratiedatum: sampleDate,
      verwachtte_einddatum: sampleDate,
      uiterlijke_einddatum: sampleDate,
      einddatum: sampleDate,
      zaak_type: 'zaaktype1',
      status: 'open',
    }, {
      identifier: '456',
      internal_id: 'zaak/nogeenuuid',
      registratiedatum: sampleDate,
      verwachtte_einddatum: sampleDate,
      uiterlijke_einddatum: sampleDate,
      einddatum: sampleDate,
      zaak_type: 'zaaktype1',
      status: 'open',
      resultaat: 'vergunning verleend',
    },
    {
      identifier: '234',
      internal_id: 'inzending/234',
      registratiedatum: sampleDate,
      zaak_type: 'inzending',
      status: 'ontvangen',
    },
  ];

  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  global.fetch = jest.fn((url: string) =>
    Promise.resolve({
      ok: true,
      json: () => {
        console.debug('mocked fetch', url);
        return Promise.resolve(mockedZakenList);
      },
      headers: {
        get: () => jest.fn(),
      },
    }),
  ) as jest.Mock;
});


const ddbMock = mockClient(DynamoDBClient);
const secretsMock = mockClient(SecretsManagerClient);
const output: GetSecretValueCommandOutput = {
  $metadata: {},
  SecretString: 'ditiseennepgeheim',
};
secretsMock.on(GetSecretValueCommand).resolves(output);


beforeEach(() => {
  ddbMock.reset();
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      data: {
        M: {
          loggedin: { BOOL: true },
          identifier: { S: '900222670' },
          bsn: { S: '900222670' },
          user_type: { S: 'person' },
          state: { S: '12345' },
          username: { S: 'Jan de Tester' },
        },
      },
    },
  };
  ddbMock.on(GetItemCommand).resolves(getItemOutput);
});

test('Returns 200', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const handler = new HomeRequestHandler(dynamoDBClient);
  const result = await handler.handleRequest({ cookies: 'session=12345', responseType: 'html' });

  expect(result.statusCode).toBe(200);
  let cookies = result?.cookies?.filter((cookie: string) => cookie.indexOf('HttpOnly; Secure'));
  expect(cookies?.length).toBe(1);
});

test('Shows overview page', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const handler = new HomeRequestHandler(dynamoDBClient);
  const result = await handler.handleRequest({ cookies: 'session=12345', responseType: 'html' });
  expect(result.body).toMatch('Mijn Nijmegen');
  expect(result.body).toMatch('Jan de Tester');
  fs.writeFile(path.join(__dirname, 'output', 'test2.html'), result.body ? result.body.replace(new RegExp('href="/static', 'g'), 'href="../../../static-resources/static') : '', () => { });
});

// Test does not seem to make html - but json - and does not find zaaktype. And has duplicate name
xtest('Shows overview page - disabled', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const handler = new HomeRequestHandler(dynamoDBClient);
  const result = await handler.handleRequest({ cookies: 'session=12345', responseType: 'json' });
  expect(result.body).toMatch('<td>zaaktype1</td>');
  fs.writeFile(path.join(__dirname, 'output', 'test.json'), result.body ? result.body.replace(new RegExp('href="/static', 'g'), 'href="../../../static-resources/static') : '', () => { });
});

test('Does not show contactgegevens notice when email missing and feature flag enabled', async () => {
  process.env.CONTACTGEGEVENS_LIVE = 'True';
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      data: {
        M: {
          loggedin: { BOOL: true },
          identifier: { S: '900222670' },
          bsn: { S: '900222670' },
          user_type: { S: 'person' },
          username: { S: 'Jan de Tester' },
          phonenumber: { S: '0612345678' },
        },
      },
    },
  };
  ddbMock.on(GetItemCommand).resolves(getItemOutput);

  const handler = new HomeRequestHandler(dynamoDBClient);
  const result = await handler.handleRequest({ cookies: 'session=12345', responseType: 'html' });
  expect(result.body).not.toMatch('Contactgegevens doorgeven');
  expect(result.body).toMatch('/persoonsgegevens');
  delete process.env.CONTACTGEGEVENS_LIVE;
});

test('Does not show contactgegevens notice when phonenumber missing and feature flag enabled', async () => {
  process.env.CONTACTGEGEVENS_LIVE = 'True';
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      data: {
        M: {
          loggedin: { BOOL: true },
          identifier: { S: '900222670' },
          bsn: { S: '900222670' },
          user_type: { S: 'person' },
          username: { S: 'Jan de Tester' },
          email: { S: 'test@example.com' },
        },
      },
    },
  };
  ddbMock.on(GetItemCommand).resolves(getItemOutput);

  const handler = new HomeRequestHandler(dynamoDBClient);
  const result = await handler.handleRequest({ cookies: 'session=12345', responseType: 'html' });
  expect(result.body).not.toMatch('Contactgegevens doorgeven');
  delete process.env.CONTACTGEGEVENS_LIVE;
});

test('Does not show contactgegevens notice when both email and phonenumber present', async () => {
  process.env.CONTACTGEGEVENS_LIVE = 'True';
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      data: {
        M: {
          loggedin: { BOOL: true },
          identifier: { S: '900222670' },
          bsn: { S: '900222670' },
          user_type: { S: 'person' },
          username: { S: 'Jan de Tester' },
          email: { S: 'test@example.com' },
          phonenumber: { S: '0612345678' },
        },
      },
    },
  };
  ddbMock.on(GetItemCommand).resolves(getItemOutput);

  const handler = new HomeRequestHandler(dynamoDBClient);
  const result = await handler.handleRequest({ cookies: 'session=12345', responseType: 'html' });
  expect(result.body).not.toMatch('Contactgegevens doorgeven');
  delete process.env.CONTACTGEGEVENS_LIVE;
});

test('Does not show contactgegevens notice when feature flag disabled', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const handler = new HomeRequestHandler(dynamoDBClient);
  const result = await handler.handleRequest({ cookies: 'session=12345', responseType: 'html' });
  expect(result.body).not.toMatch('Contactgegevens doorgeven');
});


test('Does show contactgegevens notice when feature flag enabled and no contactgegevens', async () => {
  process.env.CONTACTGEGEVENS_LIVE = 'True';
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      data: {
        M: {
          loggedin: { BOOL: true },
          identifier: { S: '900222670' },
          bsn: { S: '900222670' },
          user_type: { S: 'person' },
          username: { S: 'Jan de Tester' },
          // email: { S: 'test@example.com' }, // Undefined
          // phonenumber: { S: '0612345678' }, // Undefined
        },
      },
    },
  };
  ddbMock.on(GetItemCommand).resolves(getItemOutput);

  const handler = new HomeRequestHandler(dynamoDBClient);
  const result = await handler.handleRequest({ cookies: 'session=12345', responseType: 'html' });
  expect(result.body).toMatch('Contactgegevens doorgeven');
  delete process.env.CONTACTGEGEVENS_LIVE;
});


describe('Loading zaken and taken fails', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  const zakenResponse = { incompleteResults: false, results: [] };
  const takenResponse = { incompleteResults: false, results: [] };
  const timeoutError = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');

  /**
   * Mock the zaakaggregator, by default the taken and zaken calls succeed
   */
  function mockAggregator(responses: { zaken?: () => Promise<any>; taken?: () => Promise<any> }) {
    const ok = (json: any) => async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => json });
    const handlers: Record<string, () => Promise<any>> = {
      '/zaken': responses.zaken ?? ok(zakenResponse),
      '/taken': responses.taken ?? ok(takenResponse),
    };
    global.fetch = jest.fn((url: URL) => handlers[url.pathname]()) as jest.Mock;
  }
  const errorStatus = (status: number) => async () => ({ ok: false, status, headers: { get: () => null }, json: async () => { throw new SyntaxError('Unexpected end of JSON input'); } });

  async function request(responseType: 'html' | 'json') {
    const handler = new HomeRequestHandler(new DynamoDBClient({ region: 'eu-west-1' }), { showTaken: true });
    return handler.handleRequest({ cookies: 'session=12345', responseType });
  }

  test.each([
    ['an error status', errorStatus(500)],
    ['an unexpected response body', async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ message: 'Endpoint request timed out' }) })],
    ['a network error', async () => { throw new TypeError('fetch failed'); }],
    ['a timeout', async () => { throw timeoutError(); }],
  ])('Taken failing with %s shows zaken and a placeholder for taken', async (_, taken) => {
    mockAggregator({ taken });
    const result = await request('html');
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatch('data-loaded="false"');
    expect(result.body).toMatch('<p id="taken-list">Bezig met ophalen van uw open taken');
    expect(result.body).toMatch('id="open-zaken-list"');
    expect(result.body).not.toMatch('Bezig met ophalen van uw open zaken');
  });

  test('Zaken failing shows taken and a placeholder for zaken', async () => {
    mockAggregator({ zaken: errorStatus(502) });
    const result = await request('html');
    expect(result.body).toMatch('data-loaded="false"');
    expect(result.body).toMatch('<p id="open-zaken-list">Bezig met ophalen van uw open zaken');
    expect(result.body).toMatch('U heeft geen openstaande taken');
  });

  test('Does not load async when everything loaded', async () => {
    mockAggregator({});
    const result = await request('html');
    expect(result.body).not.toMatch('data-loaded="false"');
    expect(result.body).not.toMatch('Bezig met ophalen');
  });

  test('JSON returns the loaded sections with a retryable error status', async () => {
    mockAggregator({ taken: errorStatus(500) });
    const result = await request('json');
    expect(result.statusCode).toBe(503);
    const body = JSON.parse(result.body ?? '');
    expect(body.elements).toHaveLength(1);
    expect(body.elements[0]).toMatch('id="open-zaken-list"');
  });

  test('JSON returns 408 when only timeouts occurred', async () => {
    mockAggregator({ taken: async () => { throw timeoutError(); } });
    const result = await request('json');
    expect(result.statusCode).toBe(408);
  });

  test('JSON returns all sections when everything loaded', async () => {
    mockAggregator({});
    const result = await request('json');
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body ?? '').elements).toHaveLength(2);
  });
});
