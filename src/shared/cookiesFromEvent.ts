interface CookieSource {
  cookies?: string[];
  headers?: Record<string, string | undefined>;
}

/**
 * Get the request cookies from an API Gateway v2 (HTTP API) event as a
 * single cookie string.
 *
 * API Gateway moves the Cookie header into the `cookies` array. Local
 * emulators such as MiniStack (see test/local) leave it in the (lowercased)
 * `cookie` header instead, so fall back to that.
 *
 * @returns the cookies, or undefined if the request has none
 */
export function cookiesFromEvent(event?: CookieSource): string | undefined {
  if (event?.cookies) {
    return event.cookies.join(';');
  }
  return event?.headers?.cookie;
}
