import { OpenIDConnectV2 } from '../OpenIDConnectV2';

const mockDiscovery = jest.fn();
const mockBuildAuthorizationUrl = jest.fn();
const mockAuthorizationCodeGrant = jest.fn();

jest.mock('openid-client', () => ({
  discovery: (...args: any[]) => mockDiscovery(...args),
  buildAuthorizationUrl: (...args: any[]) => mockBuildAuthorizationUrl(...args),
  authorizationCodeGrant: (...args: any[]) => mockAuthorizationCodeGrant(...args),
}));

describe('OpenIDConnectV2', () => {
  const mockConfig = {
    wellknown: 'https://example.com/.well-known/openid-configuration',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUrl: 'https://example.com/callback',
  };

  const mockOidcConfig = {
    authorization_endpoint: 'https://example.com/authorize',
  };

  beforeEach(() => {
    mockDiscovery.mockClear();
    mockBuildAuthorizationUrl.mockClear();
    mockAuthorizationCodeGrant.mockClear();
  });

  describe('getLoginUrl', () => {
    it('should generate login URL with correct parameters', async () => {
      const mockUrl = new URL('https://example.com/authorize?state=test-state&scope=openid');
      mockDiscovery.mockResolvedValue(mockOidcConfig);
      mockBuildAuthorizationUrl.mockReturnValue(mockUrl);

      const client = new OpenIDConnectV2(mockConfig);
      const result = await client.getLoginUrl('test-state', 'openid profile');

      expect(mockDiscovery).toHaveBeenCalledWith(
        new URL(mockConfig.wellknown),
        mockConfig.clientId,
        { client_secret: mockConfig.clientSecret, client_id: mockConfig.clientId }
      );
      expect(mockBuildAuthorizationUrl).toHaveBeenCalledWith(
        mockOidcConfig,
        expect.objectContaining({
          redirect_uri: mockConfig.redirectUrl,
          response_types: 'code',
          scope: 'openid profile',
          state: 'test-state',
        })
      );
      expect(result).toBe(mockUrl.toString());
    });

    it('should include additional options', async () => {
      const mockUrl = new URL('https://example.com/authorize');
      mockDiscovery.mockResolvedValue(mockOidcConfig);
      mockBuildAuthorizationUrl.mockReturnValue(mockUrl);

      const client = new OpenIDConnectV2(mockConfig);
      await client.getLoginUrl('test-state', 'openid', { nonce: 'test-nonce' });

      expect(mockBuildAuthorizationUrl).toHaveBeenCalledWith(
        mockOidcConfig,
        expect.objectContaining({
          nonce: 'test-nonce',
        })
      );
    });
  });

  describe('authorize', () => {
    it('should complete authorization flow successfully', async () => {
      const mockClaims = { sub: '123', email: 'test@example.com' };
      const mockAuthorized = {
        access_token: 'mock-access-token',
        scope: 'openid profile',
        claims: jest.fn().mockReturnValue(mockClaims),
      };
      mockDiscovery.mockResolvedValue(mockOidcConfig);
      mockAuthorizationCodeGrant.mockResolvedValue(mockAuthorized);

      const client = new OpenIDConnectV2(mockConfig);
      const callbackUrl = new URL('https://example.com/callback?code=test-code&state=test-state');
      const result = await client.authorize(callbackUrl, 'test-state');

      expect(mockAuthorizationCodeGrant).toHaveBeenCalledWith(
        mockOidcConfig,
        callbackUrl,
        { expectedState: 'test-state' }
      );
      expect(result.claims).toEqual(mockClaims);
      expect(result.scopes).toEqual(['openid', 'profile']);
    });

    it('should throw error when no access token', async () => {
      const mockAuthorized = {
        access_token: undefined,
        claims: jest.fn(),
      };
      mockDiscovery.mockResolvedValue(mockOidcConfig);
      mockAuthorizationCodeGrant.mockResolvedValue(mockAuthorized);

      const client = new OpenIDConnectV2(mockConfig);
      const callbackUrl = new URL('https://example.com/callback?code=test-code');

      await expect(client.authorize(callbackUrl, 'test-state')).rejects.toThrow('No access token returned from idp');
    });

    it('should throw error when no claims', async () => {
      const mockAuthorized = {
        access_token: 'mock-token',
        scope: 'openid',
        claims: jest.fn().mockReturnValue(null),
      };
      mockDiscovery.mockResolvedValue(mockOidcConfig);
      mockAuthorizationCodeGrant.mockResolvedValue(mockAuthorized);

      const client = new OpenIDConnectV2(mockConfig);
      const callbackUrl = new URL('https://example.com/callback?code=test-code');

      await expect(client.authorize(callbackUrl, 'test-state')).rejects.toThrow('No ID token or scope found in idp response');
    });
  });

  describe('generateState', () => {
    it('should generate a UUID', () => {
      const client = new OpenIDConnectV2(mockConfig);
      const state = client.generateState();

      expect(state).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('configuration caching', () => {
    it('should cache OIDC configuration', async () => {
      const mockUrl = new URL('https://example.com/authorize');
      mockDiscovery.mockResolvedValue(mockOidcConfig);
      mockBuildAuthorizationUrl.mockReturnValue(mockUrl);

      const client = new OpenIDConnectV2(mockConfig);
      await client.getLoginUrl('state1', 'openid');
      await client.getLoginUrl('state2', 'openid');

      expect(mockDiscovery).toHaveBeenCalledTimes(1);
    });
  });
});
