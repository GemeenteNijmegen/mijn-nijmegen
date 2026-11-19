import { cookiesFromEvent } from '../cookiesFromEvent';

describe('cookiesFromEvent', () => {
  test('joins the cookies array', () => {
    expect(cookiesFromEvent({ cookies: ['session=abc', 'other=def'] })).toBe('session=abc;other=def');
  });

  test('prefers the cookies array over the cookie header', () => {
    expect(cookiesFromEvent({
      cookies: ['session=abc'],
      headers: { cookie: 'session=header' },
    })).toBe('session=abc');
  });

  test('falls back to the cookie header', () => {
    expect(cookiesFromEvent({ headers: { cookie: 'session=abc; other=def' } })).toBe('session=abc; other=def');
  });

  test('returns undefined without cookies', () => {
    expect(cookiesFromEvent({ headers: {} })).toBeUndefined();
    expect(cookiesFromEvent(undefined)).toBeUndefined();
  });
});
