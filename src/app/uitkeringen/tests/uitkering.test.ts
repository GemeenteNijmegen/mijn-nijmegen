import * as fs from 'fs';
import * as path from 'path';
import { DynamoDBClient, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { SecretsManagerClient, GetSecretValueCommandOutput } from '@aws-sdk/client-secrets-manager';
import { SSMClient, GetParameterCommandOutput } from '@aws-sdk/client-ssm';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { mockClient } from 'jest-aws-client-mock';
import { uitkeringsRequestHandler } from '../uitkeringsRequestHandler';

beforeAll(() => {
  if (process.env.VERBOSETESTS!='True') {
    global.console.error = jest.fn();
    global.console.time = jest.fn();
    global.console.log = jest.fn();
  }
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
  secretsMock.mockImplementation(() => secretsOutput);
  const ssmOutput: GetParameterCommandOutput = {
    $metadata: {},
    Parameter: {
      Value: 'test',
    },
  };

  secretsMock.mockImplementation(() => secretsOutput);
  parameterStoreMock.mockImplementation(() => ssmOutput);
  //create output folder for test html if it does not exist yet

  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
});

const ddbMock = mockClient(DynamoDBClient);
const secretsMock = mockClient(SecretsManagerClient);
const axiosMock = new MockAdapter(axios);
const parameterStoreMock = mockClient(SSMClient);

const apiClient = new ApiClient('test', 'test', 'test');
const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });

const requestHandler = new uitkeringsRequestHandler({ apiClient, dynamoDBClient });
beforeEach(() => {
  ddbMock.mockReset();
  secretsMock.mockReset();
  axiosMock.reset();

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
  ddbMock.mockImplementation(() => getItemOutput);
});

describe('Loading the uitkeringspagina', () => {

  test('Returns 200', async () => {
    const output: GetSecretValueCommandOutput = {
      $metadata: {},
      SecretString: 'ditiseennepgeheim',
    };
    secretsMock.mockImplementation(() => output);
    const file = 'uitkering-12345678.xml';
    const filePath = path.join('responses', file);
    const returnData = await getStringFromFilePath(filePath)
      .then((data: any) => {
        return data;
      });
    axiosMock.onPost().reply(200, returnData);

    const result = await requestHandler.handleRequest('session=12345');
    expect(result.statusCode).toBe(200);
  });

  test('Shows overview page', async () => {
    const output: GetSecretValueCommandOutput = {
      $metadata: {},
      SecretString: 'ditiseennepgeheim',
    };
    secretsMock.mockImplementation(() => output);

    const file = 'uitkering-12345678.xml';
    const filePath = path.join('responses', file);
    const returnData = await getStringFromFilePath(filePath)
      .then((data: any) => {
        return data;
      });
    axiosMock.onPost().reply(200, returnData);
    const result = await requestHandler.handleRequest('session=12345');
    expect(result.body).toMatch('Mijn Uitkering');
    expect(result.body).toMatch('Participatiewet');
    if (!result.body) {
      return;
    }
    fs.writeFile(path.join(__dirname, 'output', 'test.html'), result.body.replace( new RegExp('href="/static', 'g'), 'href="../../../static-resources/static'), () => {});
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
    ddbMock.mockImplementation(() => getItemOutput);

    const output: GetSecretValueCommandOutput = {
      $metadata: {},
      SecretString: 'ditiseennepgeheim',
    };
    secretsMock.mockImplementation(() => output);

    const result = await requestHandler.handleRequest('session=12345');
    expect(result.statusCode).toBe(302);
  });


  test('Shows two uitkeringen page', async () => {
    const output: GetSecretValueCommandOutput = {
      $metadata: {},
      SecretString: 'ditiseennepgeheim',
    };
    secretsMock.mockImplementation(() => output);

    const file = 'tweeuitkeringen.xml';
    const filePath = path.join('responses', file);
    const returnData = await getStringFromFilePath(filePath)
      .then((data: any) => {
        return data;
      });
    axiosMock.onPost().reply(200, returnData);
    const result = await requestHandler.handleRequest('session=12345');
    expect(result.body).toMatch('Mijn Uitkering');
    expect(result.body).toMatch('Participatiewet');
    if (!result.body) {
      return;
    }
    fs.writeFile(path.join(__dirname, 'output', 'test-twee.html'), result.body.replace( new RegExp('href="/static', 'g'), 'href="../../../static-resources/static'), () => {});
  });


  test('Shows empty page', async () => {
    const output: GetSecretValueCommandOutput = {
      $metadata: {},
      SecretString: 'ditiseennepgeheim',
    };
    secretsMock.mockImplementation(() => output);

    const file = 'empty.xml';
    const filePath = path.join('responses', file);
    const returnData = await getStringFromFilePath(filePath)
      .then((data: any) => {
        return data;
      });
    axiosMock.onPost().reply(200, returnData);
    const result = await requestHandler.handleRequest('session=12345');
    expect(result.body).toMatch('Mijn Uitkering');
    expect(result.body).toMatch('U heeft geen lopende uitkeringen');
    if (!result.body) {
      return;
    }
    fs.writeFile(path.join(__dirname, 'output', 'test-empty.html'), result.body.replace( new RegExp('href="/static', 'g'), 'href="../../../static-resources/static'), () => {});
  });


  test('Shows error page', async () => {
    const output: GetSecretValueCommandOutput = {
      $metadata: {},
      SecretString: 'ditiseennepgeheim',
    };
    secretsMock.mockImplementation(() => output);

    axiosMock.onPost().reply(404);
    const result = await requestHandler.handleRequest('session=12345');
    expect(result.body).toMatch('Mijn Uitkering');
    expect(result.body).toMatch('Er is iets misgegaan');
    if (!result.body) {
      return;
    }
    fs.writeFile(path.join(__dirname, 'output', 'test-error.html'), result.body.replace( new RegExp('href="/static', 'g'), 'href="../../../static-resources/static'), () => {});
  });

  async function getStringFromFilePath(filePath: string): Promise<string> {
    return new Promise((res, rej) => {
      fs.readFile(path.join(__dirname, filePath), (err, data) => {
        if (err) {return rej(err);}
        return res(data.toString());
      });
    });
  }
});

describe('Unexpected requests', () => {
  test('No cookies set should redirect to login page', async() => {

    const result = await requestHandler.handleRequest('');
    expect(result.statusCode).toBe(302);
    expect(result!.headers!.Location).toMatch('/login');
  });
});
