import { VerIdAuthenticator } from '../VerIdAuthenticator';

const VALID_BSN = '900222670';
const CALLBACK = new URL('https://mijn.example.com/auth?code=abc&state=the-state');

function fakeClient(overrides: { finishSession?: jest.Mock; createSession?: jest.Mock } = {}) {
  return {
    createSession: overrides.createSession ?? jest.fn().mockResolvedValue({ url: 'https://verid.example.com/authorize?x=1', state: 'the-state' }),
    finishSession: overrides.finishSession ?? jest.fn().mockResolvedValue({
      format: 'openid',
      payload: { sub: 'pairwise-sub', nin: { identifier: VALID_BSN, identifier_type: 'NL_BSN' } },
      rawToken: 'jwt',
    }),
  } as any;
}

describe('VerIdAuthenticator', () => {
  test('start requests the openid and nin scopes and returns url and state', async () => {
    const client = fakeClient();
    const result = await new VerIdAuthenticator({ client }).start();
    expect(client.createSession).toHaveBeenCalledWith({ scope: 'openid nin' });
    expect(result).toEqual({ url: 'https://verid.example.com/authorize?x=1', state: 'the-state' });
  });

  test('start requests the configured scope', async () => {
    const client = fakeClient();
    await new VerIdAuthenticator({ client, scope: 'openid testnin' }).start();
    expect(client.createSession).toHaveBeenCalledWith({ scope: 'openid testnin' });
  });

  test('finish returns the bsn from nin.identifier', async () => {
    const client = fakeClient();
    const bsn = await new VerIdAuthenticator({ client }).finish(CALLBACK, 'the-state');
    expect(bsn.bsn).toBe(VALID_BSN);
    expect(client.finishSession).toHaveBeenCalledWith({ callbackUrl: CALLBACK });
  });

  test('finish rejects a callback whose state differs from the stored state', async () => {
    const client = fakeClient();
    await expect(new VerIdAuthenticator({ client }).finish(CALLBACK, 'other-state'))
      .rejects.toThrow('state');
    expect(client.finishSession).not.toHaveBeenCalled();
  });

  test('finish rejects when no state was stored in the session', async () => {
    const client = fakeClient();
    await expect(new VerIdAuthenticator({ client }).finish(CALLBACK, undefined))
      .rejects.toThrow('state');
    expect(client.finishSession).not.toHaveBeenCalled();
  });

  test('finish rejects an unexpected token format', async () => {
    const client = fakeClient({ finishSession: jest.fn().mockResolvedValue({ format: 'unknown', payload: {}, rawToken: 'jwt' }) });
    await expect(new VerIdAuthenticator({ client }).finish(CALLBACK, 'the-state'))
      .rejects.toThrow('format');
  });

  test('finish rejects a token without nin', async () => {
    const client = fakeClient({ finishSession: jest.fn().mockResolvedValue({ format: 'openid', payload: { sub: 'x' }, rawToken: 'jwt' }) });
    await expect(new VerIdAuthenticator({ client }).finish(CALLBACK, 'the-state'))
      .rejects.toThrow('BSN');
  });

  test('finish rejects a nin that is not an NL_BSN', async () => {
    const client = fakeClient({
      finishSession: jest.fn().mockResolvedValue({
        format: 'openid',
        payload: { sub: 'x', nin: { identifier: VALID_BSN, identifier_type: 'DE_ID' } },
        rawToken: 'jwt',
      }),
    });
    await expect(new VerIdAuthenticator({ client }).finish(CALLBACK, 'the-state'))
      .rejects.toThrow('BSN');
  });

  test('finish rejects an invalid bsn', async () => {
    const client = fakeClient({
      finishSession: jest.fn().mockResolvedValue({
        format: 'openid',
        payload: { sub: 'x', nin: { identifier: '123', identifier_type: 'NL_BSN' } },
        rawToken: 'jwt',
      }),
    });
    await expect(new VerIdAuthenticator({ client }).finish(CALLBACK, 'the-state')).rejects.toThrow();
  });

  test('finish passes on errors from the SDK (e.g. replayed callback)', async () => {
    const client = fakeClient({ finishSession: jest.fn().mockRejectedValue(new Error('no verifier for state')) });
    await expect(new VerIdAuthenticator({ client }).finish(CALLBACK, 'the-state'))
      .rejects.toThrow('no verifier for state');
  });
});
