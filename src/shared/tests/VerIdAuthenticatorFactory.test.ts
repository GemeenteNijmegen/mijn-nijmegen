import { VerIdAuthenticator } from '../VerIdAuthenticator';
import { createVerIdAuthenticator } from '../VerIdAuthenticatorFactory';

// The VerID SDK (via jose) ships ES modules that jest cannot load, same as openid-client.
// The real SDK is exercised by the esbuild bundle of the lambdas.
const clientConstructor = jest.fn();
const cacheConstructor = jest.fn();
jest.mock('@ver-id/node-client', () => ({
  VeridAuthenticationClient: function (config: any) {
    clientConstructor(config);
    return { createSession: jest.fn(), finishSession: jest.fn() };
  },
  DynamoDBCacheManager: function (config: any) {
    cacheConstructor(config);
    return { save: jest.fn(), get: jest.fn(), remove: jest.fn() };
  },
}));

const config = {
  issuerUri: 'https://verid.example.com',
  clientId: 'flow-id',
  clientSecret: 'secret',
  redirectUri: 'https://mijn.example.com/auth',
  cacheTableName: 'verid-cache',
  region: 'eu-west-1',
};

beforeEach(() => {
  clientConstructor.mockClear();
  cacheConstructor.mockClear();
});

describe('createVerIdAuthenticator', () => {
  test('creates an authenticator', () => {
    expect(createVerIdAuthenticator(config)).toBeInstanceOf(VerIdAuthenticator);
  });

  test('passes the flow configuration to the VerID client', () => {
    createVerIdAuthenticator(config);
    expect(clientConstructor).toHaveBeenCalledWith(expect.objectContaining({
      issuerUri: 'https://verid.example.com',
      clientId: 'flow-id',
      clientSecret: 'secret',
      redirectUri: 'https://mijn.example.com/auth',
    }));
  });

  test('stores verifiers in the DynamoDB cache table for ten minutes', () => {
    createVerIdAuthenticator(config);
    expect(cacheConstructor).toHaveBeenCalledWith(expect.objectContaining({
      tableName: 'verid-cache',
      options: { ttlSeconds: 600 },
    }));
  });
});
