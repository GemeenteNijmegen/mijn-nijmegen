import * as fs from 'fs';
import path from 'path';
import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { SecretsManagerClient, GetSecretValueCommandOutput, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import { ZakenAggregatorConnector } from '../../zaken/ZakenAggregatorConnector';
import { ProductenRequestHandler } from '../productenRequestHandler';
import { mockProductCall } from './mock-product-call';


beforeAll(() => {
  if (process.env.VERBOSETESTS !== 'True') {
    global.console.error = jest.fn();
    global.console.time = jest.fn();
    // global.console.log = jest.fn();
  }
  // Mock isloggedin session
  process.env.SESSION_TABLE = 'mijnproducten-sessions';
  process.env.APPLICATION_URL_BASE = 'https://testing.example.com/';
  process.env.ZAKEN_APIGATEWAY_BASEURL = 'http://localhost/';
  process.env.ZAKEN_APIGATEWAY_APIKEY = 'fakekey';


  // Zorg dat de output-map bestaat (deze is gitignored)
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
});

const ddbMock = mockClient(DynamoDBClient);
const fetchMock = jest.fn();
jest.mock('../../zaken/ZakenAggregatorConnector');
(ZakenAggregatorConnector as jest.Mock).mockImplementation(() => {
  return {
    fetch: fetchMock,
  };
});


beforeEach(() => {

  // global.fetch = jest.fn((url: string) =>
  //   Promise.resolve({
  //     json: () => {
  //       console.debug('mocked fetch', url);
  //       return Promise.resolve([]);
  //     },
  //     headers: {
  //       get: () => jest.fn(),
  //     },
  //   }),
  // ) as jest.Mock;
  const secretsMock = mockClient(SecretsManagerClient);
  const output: GetSecretValueCommandOutput = {
    $metadata: {},
    SecretString: 'ditiseennepgeheim',
  };
  secretsMock.on(GetSecretValueCommand).resolves(output);
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
  jest.restoreAllMocks();
});

/**
 * Hulpfunctie die een PersoonsgegevensRequestHandler returned met een fake HaalCentraal API.
 * De fake API levert de meegegeven data als resultaat van de getBrpData-aanroep.
 *
 * @param fakeHaalCentraalData - De data die de HaalCentraal API retourneert.
 */
function createHandler(): ProductenRequestHandler {


  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  //const dummyApiClient = {} as ApiClient;
  return new ProductenRequestHandler({
    //apiClient: dummyApiClient,
    dynamoDBClient,

  });
}

test('Producten unique and refresh html', async () => {
  fetchMock.mockResolvedValue(mockProductCall);
  const handler = createHandler();
  const logSpy = jest.spyOn(global.console, 'log');
  const result = await handler.handleRequest('session=12345', { cookies: 'session=12345', responseType: 'html', productId: '12126e1e-9bc1-4a30-b73e-5b5aa4ce8bc4' }) as any;


  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const outputFilename = path.join(__dirname, 'output', `product_data_${timestamp}.html`);
  fs.writeFileSync(outputFilename, result.body ? result.body.replace( new RegExp('href="/static', 'g'), 'href="../../../static-resources/static') : '');
  const outputFilenameRF = path.join(__dirname, 'output', 'product_data_torefresh.html');
  fs.writeFileSync(outputFilenameRF, result.body ? result.body.replace( new RegExp('href="/static', 'g'), 'href="../../../static-resources/static') : '');


  // Should not trigger, if it does, it gives an empty page
  const errorFound = logSpy.mock.calls.some(call =>
    call.some(arg => String(arg).includes('TypeError: Cannot read properties of undefined')),
  );
  expect(errorFound).toBe(false);
  expect(result.body).not.toMatch('<h2>Er is iets misgegaan</h2>');
});
