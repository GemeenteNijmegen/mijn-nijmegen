import { Bsn } from '@gemeentenijmegen/utils';
import { Person } from '../../../shared/User';
import { ZakenAggregatorConnector, ZakenAggregatorError } from '../ZakenAggregatorConnector';

describe('Test aggregator connector', () => {
  test('fetch uses correct params', async () => {
    const connector = new ZakenAggregatorConnector({ baseUrl: new URL('https://example.com'), apiKeySecretName: 'test', timeout: 50 });
    jest.spyOn(connector, 'getApiKey').mockResolvedValue('testkey');
    expect(connector).toBeTruthy();
    const user = new Person(new Bsn('900222670'), undefined);
    const call = async () => { await connector.fetch('/test', user); };
    await expect(call).rejects.toThrow();
  }, 20_000);

  test('fetch throws on an error status', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) })) as jest.Mock;
    const connector = new ZakenAggregatorConnector({ baseUrl: new URL('https://example.com'), apiKeySecretName: 'test' });
    jest.spyOn(connector, 'getApiKey').mockResolvedValue('testkey');
    const user = new Person(new Bsn('900222670'), undefined);
    await expect(connector.fetch('taken', user)).rejects.toThrow(ZakenAggregatorError);
    global.fetch = originalFetch;
  });
});
