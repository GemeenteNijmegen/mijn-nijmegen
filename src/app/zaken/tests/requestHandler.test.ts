import * as fs from 'fs';
import path from 'path';
import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { GetSecretValueCommand, GetSecretValueCommandOutput, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import * as dotenv from 'dotenv';
import { ZaakSummary } from '../ZaakInterface';
import { ZakenRequestHandler } from '../zakenRequestHandler';
dotenv.config();

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
const mockedZaak = {
  identifier: '1234',
  internal_id: 'inzending/nogeenuuid',
  registratiedatum: sampleDate,
  verwachtte_einddatum: sampleDate,
  uiterlijke_einddatum: sampleDate,
  einddatum: sampleDate,
  zaak_type: 'zaaktype 2',
  status: 'open',
  behandelaars: ['Jan Jansen', 'Andries Fietst'],
  type: 'case',
};

const mockedDownload = {
  downloadUrl: 'https://somebucket.s3.eu-central-1.amazonaws.com/APV1.234/APV1.234.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=<SOMESTRING>%2Feu-central-1%2Fs3%2Faws4_request&X-Amz-Date=20240305T135245Z&X-Amz-Expires=5&X-Amz-Security-Token=<REALLYLONGSTRING>X-Amz-Signature=<SIGNATURE>&X-Amz-SignedHeaders=host&x-id=GetObject',
};

process.env.APIGATEWAY_BASEURL = 'http://localhost/';
process.env.APIGATEWAY_APIKEY = 'fakekey';

beforeAll(() => {
  global.fetch = jest.fn((url: string) =>
    Promise.resolve({
      json: () => {
        console.debug('mocked fetch', url);
        const urlPathParts = new URL(url).pathname.split('/');
        if (urlPathParts[4]) {
          return Promise.resolve(mockedDownload);
        } else if (urlPathParts[3]) {
          return Promise.resolve(mockedZaak);
        } else {
          return Promise.resolve(mockedZakenList);
        }
      },
    }),
  ) as jest.Mock;

  const secretsMock = mockClient(SecretsManagerClient);
  const output: GetSecretValueCommandOutput = {
    $metadata: {},
    SecretString: 'ditiseennepgeheim',
  };
  secretsMock.on(GetSecretValueCommand).resolves(output);
});

const ddbMock = mockClient(DynamoDBClient);
const getItemOutput: Partial<GetItemCommandOutput> = {
  Item: {
    data: {
      M: {
        loggedin: { BOOL: true },
        identifier: { S: '900026236' },
        user_type: { S: 'person' },
        xsrf_token: { S: 'testtoken' },
      },
    },
  },
};
ddbMock.on(GetItemCommand).resolves(getItemOutput);

beforeAll(() => {
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
});

describe('Request handler class', () => {
  const handler = new ZakenRequestHandler(new DynamoDBClient({ region: process.env.AWS_REGION }));
  test('returns 200 for person', async () => {
    const result = await handler.handleRequest({ cookies: 'session=12345' });
    expect(result.statusCode).toBe(200);
    if (result.body) {
      try {
        fs.writeFile(path.join(__dirname, 'output', 'test-zaken.html'), result.body.replace( new RegExp('href="/static', 'g'), 'href="../../../static-resources/static'), () => {});
      } catch (error) {
        console.debug(error);
      }
    }
  });

  test('returns 200 for organisation', async () => {
    const getItemOutputForOrganisation: Partial<GetItemCommandOutput> = {
      Item: {
        data: {
          M: {
            loggedin: { BOOL: true },
            identifier: { S: '69599084' },
            user_type: { S: 'organisation' },
          },
        },
      },
    };
    ddbMock.on(GetItemCommand).resolves(getItemOutputForOrganisation);

    const result = await handler.handleRequest({ cookies: 'session=12345' });
    expect(result.statusCode).toBe(200);
  });

  test('returns 200 for single zaak', async () => {
    const result = await handler.handleRequest({ cookies: 'session=12345', zaakConnectorId: 'zaak', zaak: '5b1c4f8f-8c62-41ac-a3a0-e2ac08b6e886' });
    expect(result.statusCode).toBe(200);
    if (result.body) {
      try {
        fs.writeFile(path.join(__dirname, 'output', 'test.html'), result.body.replace( new RegExp('href="/static', 'g'), 'href="../../../static-resources/static'), () => { });
      } catch (error) {
        console.debug(error);
      }
    }
  });

  test('returns link for download', async () => {
    const result = await handler.handleRequest({ cookies: 'session=12345', zaakConnectorId: 'inzendingen', zaak: '5b1c4f8f-8c62-41ac-a3a0-e2ac08b6e886', file: 'test.png' });
    expect(result.statusCode).toBe(302);
    expect(result.headers).toHaveProperty('Location');
  });
});
