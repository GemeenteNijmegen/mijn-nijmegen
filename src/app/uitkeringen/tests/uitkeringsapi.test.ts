import fs from 'fs';
import path from 'path';
import { GetSecretValueCommandOutput, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { GetParameterCommandOutput, SSMClient } from '@aws-sdk/client-ssm';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { mockClient } from 'jest-aws-client-mock';
import { UitkeringsApi } from '../UitkeringsApi';

if (process.env.VERBOSETESTS!='True') {
  global.console.error = jest.fn();
  global.console.time = jest.fn();
  global.console.log = jest.fn();
}


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
  secretsMock.mockImplementation(() => secretsOutput);
  const ssmOutput: GetParameterCommandOutput = {
    $metadata: {},
    Parameter: {
      Value: 'test',
    },
  };

  secretsMock.mockImplementation(() => secretsOutput);
  parameterStoreMock.mockImplementation(() => ssmOutput);
});


const axiosMock = new MockAdapter(axios);
const secretsMock = mockClient(SecretsManagerClient);
const parameterStoreMock = mockClient(SSMClient);

process.env.MTLS_PRIVATE_KEY_ARN = 'testarn';
process.env.UITKERING_API_URL = 'http://localhost/mijnNijmegenData';

async function getStringFromFilePath(filePath: string): Promise<string> {
  return new Promise((res, rej) => {
    fs.readFile(path.join(__dirname, filePath), (err, data) => {
      if (err) {return rej(err);}
      return res(data.toString());
    });
  });
}

beforeEach(() => {
  axiosMock.reset();
  secretsMock.mockReset();
});

test('returns one uitkering', async () => {
  const file = 'uitkering-12345678.xml';
  const filePath = path.join('responses', file);
  const returnData = await getStringFromFilePath(filePath)
    .then((data: any) => {
      return data;
    });
  axiosMock.onPost().reply(200, returnData);
  const apiClient = new ApiClient('a', 'n', 'c');
  let api = new UitkeringsApi(apiClient);
  const result = await api.getUitkeringen('00000000');
  expect(axiosMock.history.post.length).toBe(1);
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
  const cert = await getStringFromFilePath(process.env.CERTPATH);
  const key = await getStringFromFilePath(process.env.KEYPATH);
  const ca = await getStringFromFilePath(process.env.CAPATH);
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
  const cert = await getStringFromFilePath(process.env.CERTPATH);
  const key = await getStringFromFilePath(process.env.KEYPATH);
  const ca = await getStringFromFilePath(process.env.CAPATH);
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
