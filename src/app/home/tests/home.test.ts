import * as fs from 'fs';
import path from 'path';
import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { GetSecretValueCommand, GetSecretValueCommandOutput, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import { ZaakSummary } from '../../zaken/ZaakInterface';
import { HomeRequestHandler } from '../homeRequestHandler';

beforeAll(() => {

  if (process.env.VERBOSETESTS!='True') {
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
      json: () => {
        console.debug('mocked fetch', url);
        return Promise.resolve(mockedZakenList);
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
  const handler = new HomeRequestHandler(dynamoDBClient, { showZaken: false });
  const result = await handler.handleRequest({ cookies: 'session=12345', responseType: 'html' });

  expect(result.statusCode).toBe(200);
  let cookies = result?.cookies?.filter((cookie: string) => cookie.indexOf('HttpOnly; Secure'));
  expect(cookies?.length).toBe(1);
});

test('Shows overview page', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const handler = new HomeRequestHandler(dynamoDBClient, { showZaken: true });
  const result = await handler.handleRequest({ cookies: 'session=12345', responseType: 'html' });
  expect(result.body).toMatch('Mijn Nijmegen');
  expect(result.body).toMatch('Jan de Tester');
  fs.writeFile(path.join(__dirname, 'output', 'test2.html'), result.body ? result.body.replace( new RegExp('href="/static', 'g'), 'href="../../../static-resources/static') : '', () => { });
});


test('Shows overview page', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const handler = new HomeRequestHandler(dynamoDBClient, { showZaken: true });
  const result = await handler.handleRequest({ cookies: 'session=12345', responseType: 'json' });
  expect(result.body).toMatch('elements');
  fs.writeFile(path.join(__dirname, 'output', 'test.json'), result.body ? result.body.replace( new RegExp('href="/static', 'g'), 'href="../../../static-resources/static') : '', () => { });
});
