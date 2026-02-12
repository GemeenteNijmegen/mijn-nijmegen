import { Bsn } from '@gemeentenijmegen/utils';
import { Person } from '../../../shared/User';
import { ZakenAggregatorConnector } from '../ZakenAggregatorConnector';

describe('Test aggregator connector', () => {
  test('fetch uses correct params', async () => {
    const connector = new ZakenAggregatorConnector({ baseUrl: new URL('https://example.com'), apiKeySecretName: 'test', timeout: 50 });
    jest.spyOn(connector, 'getApiKey').mockResolvedValue('testkey');
    expect(connector).toBeTruthy();
    const user = new Person(new Bsn('900222670'), undefined);
    const call = async () => { await connector.fetch('/test', user); };
    await expect(call).rejects.toThrow();
  });
});
