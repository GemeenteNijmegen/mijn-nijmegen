import { DynamoDBClient, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { GetSecretValueCommandOutput, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { GetParameterCommandOutput, SSMClient } from '@aws-sdk/client-ssm';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { mockClient } from 'aws-sdk-client-mock';
import * as fs from 'fs';
import * as path from 'path';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { uitkeringsRequestHandler } from '../uitkeringsRequestHandler';

vi.mock('@gemeentenijmegen/apiclient', () => ({
  ApiClient: class {
    postData = vi.fn();
    constructor(arg1?: any, arg2?: any, arg3?: any) { }
  },
}));

beforeAll(() => {

  // Set env variables
  process.env.SESSION_TABLE = 'mijnuitkering-sessions';
  process.env.AUTH_URL_BASE = 'https://authenticatie-accp.nijmegen.nl';
  process.env.APPLICATION_URL_BASE = 'https://testing.example.com/';
  process.env.CLIENT_SECRET_ARN = '123';
  process.env.OIDC_CLIENT_ID = '1234';
  process.env.OIDC_SCOPE = 'openid';


  process.env.MTLS_PRIVATE_KEY_ARN = 'testarn';

  const secretsOutput: GetSecretValueCommandOutput = {
    $metadata: {},
    SecretString: 'test',
  };
  secretsMock.resolves(secretsOutput);
  const ssmOutput: GetParameterCommandOutput = {
    $metadata: {},
    Parameter: {
      Value: 'test',
    },
  };

  secretsMock.resolves(secretsOutput);
  parameterStoreMock.resolves(ssmOutput);
  //create output folder for test html if it does not exist yet

  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
});

const ddbMock = mockClient(DynamoDBClient);
const secretsMock = mockClient(SecretsManagerClient);
const parameterStoreMock = mockClient(SSMClient);

const apiClient = new ApiClient('test', 'test', 'test');
const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });

const requestHandler = new uitkeringsRequestHandler({ apiClient, dynamoDBClient });
beforeEach(() => {
  ddbMock.reset();
  secretsMock.reset();
  vi.clearAllMocks();

  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      data: {
        M: {
          loggedin: { BOOL: true },
          identifier: { S: '900026236' },
          user_type: { S: 'person' },
        },
      },
    },
  };
  ddbMock.resolves(getItemOutput);
});

describe('Loading the uitkeringspagina', () => {

  test('Returns 200', async () => {
    const output: GetSecretValueCommandOutput = {
      $metadata: {},
      SecretString: 'ditiseennepgeheim',
    };
    secretsMock.resolves(output);
    const file = 'uitkering-12345678.xml';
    const filePath = path.join(__dirname, 'responses', file);
    const returnData = fs.readFileSync(filePath).toString();
    vi.mocked(apiClient.postData).mockResolvedValue(returnData);

    const result = await requestHandler.handleRequest('session=12345');
    expect(result.statusCode).toBe(200);
  });

  test('Shows overview page', async () => {
    const output: GetSecretValueCommandOutput = {
      $metadata: {},
      SecretString: 'ditiseennepgeheim',
    };
    secretsMock.resolves(output);

    const file = 'uitkering-12345678.xml';
    const filePath = path.join(__dirname, 'responses', file);
    const returnData = fs.readFileSync(filePath).toString();

    vi.mocked(apiClient.postData).mockResolvedValue(returnData);
    const result = await requestHandler.handleRequest('session=12345');
    expect(result.body).toMatch('Mijn Uitkering');
    expect(result.body).toMatch('Participatiewet');
    if (!result.body) {
      return;
    }
    fs.writeFile(path.join(__dirname, 'output', 'test.html'), result.body.replace(new RegExp('href="/static', 'g'), 'href="../../../static-resources/static'), () => { });
  });

  test('Companies are redirected', async () => {
    const getItemOutput: Partial<GetItemCommandOutput> = {
      Item: {
        data: {
          M: {
            loggedin: { BOOL: true },
            identifier: { S: '12345678' },
            user_type: { S: 'company' },
          },
        },
      },
    };
    ddbMock.resolves(getItemOutput);

    const output: GetSecretValueCommandOutput = {
      $metadata: {},
      SecretString: 'ditiseennepgeheim',
    };
    secretsMock.resolves(output);

    const result = await requestHandler.handleRequest('session=12345');
    expect(result.statusCode).toBe(302);
  });


  test('Shows two uitkeringen page', async () => {
    const output: GetSecretValueCommandOutput = {
      $metadata: {},
      SecretString: 'ditiseennepgeheim',
    };
    secretsMock.resolves(output);

    const file = 'tweeuitkeringen.xml';
    const filePath = path.join(__dirname, 'responses', file);
    const returnData = fs.readFileSync(filePath).toString();

    vi.mocked(apiClient.postData).mockResolvedValue(returnData);
    const result = await requestHandler.handleRequest('session=12345');
    expect(result.body).toMatch('Mijn Uitkering');
    expect(result.body).toMatch('Participatiewet');
    if (!result.body) {
      return;
    }
    fs.writeFile(path.join(__dirname, 'output', 'test-twee.html'), result.body.replace(new RegExp('href="/static', 'g'), 'href="../../../static-resources/static'), () => { });
  });


  test('Shows empty page', async () => {
    const output: GetSecretValueCommandOutput = {
      $metadata: {},
      SecretString: 'ditiseennepgeheim',
    };
    secretsMock.resolves(output);

    const file = 'empty.xml';
    const filePath = path.join(__dirname, 'responses', file);
    const returnData = fs.readFileSync(filePath).toString();

    vi.mocked(apiClient.postData).mockResolvedValue(returnData);
    const result = await requestHandler.handleRequest('session=12345');
    expect(result.body).toContain('Mijn Uitkering');
    expect(result.body).toContain('U heeft geen lopende uitkeringen');
    if (!result.body) {
      return;
    }
    fs.writeFile(path.join(__dirname, 'output', 'test-empty.html'), result.body.replace(new RegExp('href="/static', 'g'), 'href="../../../static-resources/static'), () => { });
  });


  test('Shows error page', async () => {
    const output: GetSecretValueCommandOutput = {
      $metadata: {},
      SecretString: 'ditiseennepgeheim',
    };
    secretsMock.resolves(output);

    vi.mocked(apiClient.postData).mockRejectedValue(new Error('Request failed'));
    const result = await requestHandler.handleRequest('session=12345');
    expect(result.body).toContain('Mijn Uitkering');
    expect(result.body).toContain('Er is iets misgegaan');
    if (!result.body) {
      return;
    }
    fs.writeFile(path.join(__dirname, 'output', 'test-error.html'), result.body.replace(new RegExp('href="/static', 'g'), 'href="../../../static-resources/static'), () => { });
  });

});

describe('Unexpected requests', () => {
  test('No cookies set should redirect to login page', async () => {

    const result = await requestHandler.handleRequest('');
    expect(result.statusCode).toBe(302);
    expect(result!.headers!.Location).toMatch('/login');
  });
});
