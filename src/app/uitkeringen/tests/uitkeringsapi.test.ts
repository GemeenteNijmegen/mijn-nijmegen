import { GetSecretValueCommandOutput, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { GetParameterCommandOutput, SSMClient } from '@aws-sdk/client-ssm';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { mockClient } from 'aws-sdk-client-mock';
import { readFileSync } from 'fs';
import path, { join } from 'path';
import { beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { UitkeringsApi } from '../UitkeringsApi';

vi.mock('@gemeentenijmegen/apiclient', () => ({
  ApiClient: class {
    postData = vi.fn();
    constructor(arg1?: any, arg2?: any, arg3?: any) { }
  },
}));



beforeAll(() => {
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


const secretsMock = mockClient(SecretsManagerClient);
const parameterStoreMock = mockClient(SSMClient);

process.env.MTLS_PRIVATE_KEY_ARN = 'testarn';
process.env.UITKERING_API_URL = 'http://localhost/mijnNijmegenData';


beforeEach(() => {
  vi.clearAllMocks();
  secretsMock.reset();
});

test('returns one uitkering', async () => {
  const file = 'uitkering-12345678.xml';
  const filePath = path.join(__dirname, 'responses', file);
  const returnData = readFileSync(filePath);

  const apiClient = new ApiClient('a', 'n', 'c');
  vi.mocked(apiClient.postData).mockResolvedValue(returnData);
  let api = new UitkeringsApi(apiClient);
  const result = await api.getUitkeringen('00000000');
  expect(vi.mocked(apiClient.postData)).toHaveBeenCalledTimes(1);
  expect(result.uitkeringen).toHaveLength(1);
  expect(result.uitkeringen[0].fields).toBeInstanceOf(Array);
});

// This test doesn't run in CI by default, depends on unavailable secrets
test('Http Api', async () => {
  if (
    !process.env.CERTPATH
    || !process.env.KEYPATH
    || !process.env.CAPATH
    || !process.env.BSN
    || !process.env.UITKERING_API_URL
    || !process.env.UITKERING_BSN) {
    console.debug('skipping live api test');
    return;
  }

  const cert = readFileSync(join(__dirname, process.env.CERTPATH)).toString();
  const key = readFileSync(join(__dirname, process.env.KEYPATH)).toString();
  const ca = readFileSync(join(__dirname, process.env.CAPATH)).toString();

  if (!cert || !key || !ca) {
    expect(false).toBe(true);
  }
  const client = new ApiClient(cert, key, ca);
  const body = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
            <ns2:dataRequest xmlns:ns2="${process.env.UITKERING_API_URL}/">
                <identifier>${process.env.UITKERING_BSN}</identifier>
                <contentSource>mijnUitkering</contentSource>
            </ns2:dataRequest>
        </soap:Body>
    </soap:Envelope>`;

  const result = await client.postData(process.env.UITKERING_API_URL, body, {
    'Content-type': 'text/xml',
    'SoapAction': process.env.UITKERING_API_URL + '/getData',
  });
  expect(result).toContain('<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">');
});


// This test doesn't run in CI by default, depends on unavailable secrets
test('Http Api No result', async () => {
  if (
    !process.env.CERTPATH
    || !process.env.KEYPATH
    || !process.env.CAPATH
    || !process.env.BSN
    || !process.env.UITKERING_API_URL
    || !process.env.UITKERING_BSN) {
    console.debug('skipping live api test');
    return;
  }
  const cert = readFileSync(join(__dirname, process.env.CERTPATH)).toString();
  const key = readFileSync(join(__dirname, process.env.KEYPATH)).toString();
  const ca = readFileSync(join(__dirname, process.env.CAPATH)).toString();
  if (!cert || !key || !ca) {
    expect(false).toBe(true);
  }
  const client = new ApiClient(cert, key, ca);
  const body = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
            <ns2:dataRequest xmlns:ns2="${process.env.UITKERING_API_URL}/">
                <identifier>12345678</identifier>
                <contentSource>mijnUitkering</contentSource>
            </ns2:dataRequest>
        </soap:Body>
    </soap:Envelope>`;

  const result = await client.postData(process.env.UITKERING_API_URL, body, {
    'Content-type': 'text/xml',
    'SoapAction': process.env.UITKERING_API_URL + '/getData',
  });
  expect(result).toContain('<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">');
});
