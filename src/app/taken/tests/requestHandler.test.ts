import * as fs from 'fs';
import path from 'path';
import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { GetSecretValueCommand, GetSecretValueCommandOutput, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import * as dotenv from 'dotenv';
import { TaakrequestHandler } from '../TaakRequestHandler';

dotenv.config();


process.env.ZAKEN_APIGATEWAY_BASEURL = 'http://localhost/';
process.env.ZAKEN_APIGATEWAY_APIKEY = 'fakekey';

beforeAll(() => {
  global.fetch = jest.fn((url: string) =>
    Promise.resolve({
      json: () => {
        console.debug('mocked fetch', url);
        return Promise.resolve([]);
      },
      headers: {
        get: () => jest.fn(),
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
        username: { S: 'username' },
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
  const handler = new TaakrequestHandler(new DynamoDBClient({ region: process.env.AWS_REGION }));
  test('returns 200 for person', async () => {
    const result = await handler.handleRequest({ cookies: 'session=12345', responseType: 'html' });
    expect(result.statusCode).toBe(200);
    if (result.body) {
      try {
        fs.writeFile(path.join(__dirname, 'output', 'test.html'), result.body.replace(new RegExp('href="/static', 'g'), 'href="../../../static-resources/static'), () => { });
      } catch (error) {
        console.debug(error);
      }
    }
  });
});
