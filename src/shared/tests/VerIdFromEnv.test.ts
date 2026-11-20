import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import { verIdAuthenticatorFromEnv } from '../VerIdFromEnv';

const mockedCreate = jest.fn();
jest.mock('../VerIdAuthenticatorFactory', () => ({
  createVerIdAuthenticator: (config: any) => mockedCreate(config),
}));

const secretsMock = mockClient(SecretsManagerClient);
const ORIGINAL_ENV = process.env;

beforeEach(() => {
  secretsMock.reset();
  secretsMock.on(GetSecretValueCommand).resolves({ SecretString: 'the-secret' });
  mockedCreate.mockReset();
  mockedCreate.mockReturnValue({ fake: 'authenticator' });
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
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  test('creates the authenticator from the environment and the secret when the flag is true', async () => {
    expect(await verIdAuthenticatorFromEnv()).toEqual({ fake: 'authenticator' });
    expect(mockedCreate).toHaveBeenCalledWith({
      issuerUri: 'https://verid.example.com',
      clientId: 'flow-id',
      clientSecret: 'the-secret',
      redirectUri: 'https://mijn.example.com/auth',
      cacheTableName: 'verid-cache',
      region: 'eu-west-1',
    });
  });

  test('returns nothing instead of throwing when the configuration is broken', async () => {
    mockedCreate.mockImplementation(() => {
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
