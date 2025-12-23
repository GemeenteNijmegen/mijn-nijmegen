import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import * as fs from 'fs';
import path from 'path';
import { beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { ProductenRequestHandler } from '../productenRequestHandler';

beforeAll(() => {

  // Mock isloggedin session
  process.env.SESSION_TABLE = 'mijnproducten-sessions';
  process.env.APPLICATION_URL_BASE = 'https://testing.example.com/';

  // Zorg dat de output-map bestaat (deze is gitignored)
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
});

const ddbMock = mockClient(DynamoDBClient);

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
  vi.restoreAllMocks();
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

  const handler = createHandler();
  const logSpy = vi.spyOn(global.console, 'log');
  const result = await handler.handleRequest('session=12345') as any;


  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const outputFilename = path.join(__dirname, 'output', `producten_data_${timestamp}.html`);
  fs.writeFileSync(outputFilename, result.body ? result.body.replace(new RegExp('href="/static', 'g'), 'href="../../../static-resources/static') : '');
  const outputFilenameRF = path.join(__dirname, 'output', 'producten_data_torefresh.html');
  fs.writeFileSync(outputFilenameRF, result.body ? result.body.replace(new RegExp('href="/static', 'g'), 'href="../../../static-resources/static') : '');


  // Should not trigger, if it does, it gives an empty page
  const errorFound = logSpy.mock.calls.some(call =>
    call.some(arg => String(arg).includes('TypeError: Cannot read properties of undefined')),
  );
  expect(errorFound).toBe(false);
  expect(result.body).not.toMatch('<h2>Er is iets misgegaan</h2>');
});
