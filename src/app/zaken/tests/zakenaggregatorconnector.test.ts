import { UserFromAttributes } from '../User';
import { ZakenAggregatorConnector } from '../ZakenAggregatorConnector';

describe('Test aggregator connector', () => {
  test('fetch uses correct params', async() => {
    const connector = new ZakenAggregatorConnector({ baseUrl: new URL('https://example.com'), apiKeySecretName: 'test', timeout: 50 });
    jest.spyOn(connector, 'getApiKey').mockResolvedValue('testkey');
    expect(connector).toBeTruthy();
    const user = UserFromAttributes('person', '900222670');
    const call = async () => { await connector.fetch('/test', user); };
    await expect(call).rejects.toThrow();
  });
});
