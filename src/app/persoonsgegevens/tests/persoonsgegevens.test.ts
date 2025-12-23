/* eslint-disable import/no-extraneous-dependencies */
import { DynamoDBClient, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { GetSecretValueCommandOutput, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { GetParameterCommandOutput, SSMClient } from '@aws-sdk/client-ssm';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { mockClient } from 'aws-sdk-client-mock';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import * as fs from 'fs';
import * as path from 'path';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { PersoonsgegevensRequestHandler } from '../persoonsgegevensRequestHandler';



beforeAll(() => {
  global.console.log = vi.fn();
  // Set env variables
  process.env.SESSION_TABLE = 'mijnnijmegen-sessions';
  process.env.AUTH_URL_BASE = 'https://authenticatie-accp.nijmegen.nl';
  process.env.APPLICATION_URL_BASE = 'https://testing.example.com/';
  process.env.CLIENT_SECRET_ARN = '123';
  process.env.OIDC_CLIENT_ID = '1234';
  process.env.OIDC_SCOPE = 'openid';
  process.env.BRP_API_URL = 'https://localhost/brp';

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
});


const ddbMock = mockClient(DynamoDBClient);
const secretsMock = mockClient(SecretsManagerClient);
const axiosMock = new MockAdapter(axios);
const parameterStoreMock = mockClient(SSMClient);


beforeEach(() => {
  ddbMock.reset();
  secretsMock.reset();
  const output: GetSecretValueCommandOutput = {
    $metadata: {},
    SecretString: 'ditiseennepgeheim',
  };
  secretsMock.resolves(output);
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
  ddbMock.resolves(getItemOutput);
});

const apiClient = new ApiClient('abc', 'abc', 'abd');
const dynamoDBClient = new DynamoDBClient({});
const showZaken = true;
const handler = new PersoonsgegevensRequestHandler({ apiClient, dynamoDBClient, showZaken });

describe('Requests', () => {
  test('Return status 200', async () => {
    const file = 'brp-999993653.json';
    const filePath = path.join('responses', file);
    const returnData = await getStringFromFilePath(filePath)
      .then((data: any) => {
        return JSON.parse(data);
      });
    axiosMock.onPost().reply(200, returnData);

    const result = await handler.handleRequest('session=12345');
    expect(result.statusCode).toBe(200);
  });

  test('Return error page', async () => {
    axiosMock.onPost().reply(200, {
    });

    const result = await handler.handleRequest('session=12345');
    expect(result.statusCode).toBe(200);
  });

  test('Return error page on timeout', async () => {
    axiosMock.onPost().timeout();

    const result = await handler.handleRequest('session=12345');
    expect(result.statusCode).toBe(200);
  });


  test('Show overview page', async () => {
    const file = 'brp-999993653.json';
    const filePath = path.join('responses', file);
    const returnData = await getStringFromFilePath(filePath)
      .then((data: any) => {
        return JSON.parse(data);
      });
    axiosMock.onPost().reply(200, returnData);
    const result = await handler.handleRequest('session=12345');
    expect(result.body).toMatch('Mijn gegevens');
  });

  test('Companies get redirected', async () => {
    const getItemOutput: Partial<GetItemCommandOutput> = {
      Item: {
        data: {
          M: {
            loggedin: { BOOL: true },
            identifier: { S: '12345678' },
            user_type: { S: 'organisation ' },
          },
        },
      },
    };
    ddbMock.resolves(getItemOutput);

    const result = await handler.handleRequest('session=12345');
    expect(result.statusCode).toBe(302);
  });

});


describe('Unexpected requests', () => {
  test('No cookies set should redirect to login page', async () => {

    const result = await handler.handleRequest('');
    expect(result.statusCode).toBe(302);
    expect(result.headers?.Location).toMatch('/login');
  });
});

async function getStringFromFilePath(filePath: string) {
  return new Promise((res, rej) => {
    fs.readFile(path.join(__dirname, filePath), (err, data) => {
      if (err) { return rej(err); }
      return res(data.toString());
    });
  });
}
