import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import { VerIdAuthenticator } from '../VerIdAuthenticator';
import { verIdAuthenticatorFromEnv } from '../VerIdFromEnv';

// The VerID SDK (via jose) ships ES modules that jest cannot load, same as openid-client.
// The real SDK is exercised by the esbuild bundle of the lambdas.
const mockedClient = jest.fn();
const mockedCache = jest.fn();
jest.mock('@ver-id/node-client', () => ({
  VeridAuthenticationClient: function (config: any) {
    mockedClient(config);
    return { createSession: jest.fn(), finishSession: jest.fn() };
  },
  DynamoDBCacheManager: function (config: any) {
    mockedCache(config);
    return {};
  },
}));

const secretsMock = mockClient(SecretsManagerClient);
const ORIGINAL_ENV = process.env;

beforeEach(() => {
  secretsMock.reset();
  secretsMock.on(GetSecretValueCommand).resolves({ SecretString: 'the-secret' });
  mockedClient.mockReset();
  mockedCache.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => { });
  process.env = {
    ...ORIGINAL_ENV,
    USE_YIVI_VERID: 'true',
    VERID_ISSUER_URI: 'https://verid.example.com',
    VERID_CLIENT_ID: 'flow-id',
    VERID_REDIRECT_URL: 'https://mijn.example.com/auth',
    VERID_CLIENT_SECRET_ARN: 'arn:secret',
    VERID_CACHE_TABLE: 'verid-cache',
    AWS_REGION: 'eu-west-1',
  };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.restoreAllMocks();
});

describe('verIdAuthenticatorFromEnv', () => {
  test.each(['false', undefined, 'True', ''])('returns nothing and reads no secret when USE_YIVI_VERID is %s', async (flag) => {
    if (flag === undefined) {
      delete process.env.USE_YIVI_VERID;
    } else {
      process.env.USE_YIVI_VERID = flag;
    }
    expect(await verIdAuthenticatorFromEnv()).toBeUndefined();
    expect(secretsMock.commandCalls(GetSecretValueCommand)).toHaveLength(0);
    expect(mockedClient).not.toHaveBeenCalled();
  });

  test('creates the authenticator from the environment and the secret when the flag is true', async () => {
    expect(await verIdAuthenticatorFromEnv()).toBeInstanceOf(VerIdAuthenticator);
    expect(mockedClient).toHaveBeenCalledWith(expect.objectContaining({
      issuerUri: 'https://verid.example.com',
      clientId: 'flow-id',
      clientSecret: 'the-secret',
      redirectUri: 'https://mijn.example.com/auth',
    }));
  });

  test('keeps the PKCE verifiers in the DynamoDB table for ten minutes', async () => {
    await verIdAuthenticatorFromEnv();
    expect(mockedCache).toHaveBeenCalledWith(expect.objectContaining({ tableName: 'verid-cache', options: { ttlSeconds: 600 } }));
  });

  test('returns nothing instead of throwing when the configuration is broken', async () => {
    mockedClient.mockImplementation(() => {
      throw new Error('invalid issuer');
    });
    expect(await verIdAuthenticatorFromEnv()).toBeUndefined();
  });

  test('returns nothing instead of throwing when the secret cannot be read', async () => {
    secretsMock.reset();
    secretsMock.on(GetSecretValueCommand).rejects(new Error('denied'));
    expect(await verIdAuthenticatorFromEnv()).toBeUndefined();
  });
});
