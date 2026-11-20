import { Bsn } from '@gemeentenijmegen/utils';
import type { VeridAuthenticationClient } from '@ver-id/node-client';

export interface VerIdAuthenticatorProps {
  /**
   * The VerID authentication client (see `@ver-id/node-client`). Injected so tests
   * do not need the network. The client needs a cache store shared between lambdas,
   * because the login and the callback are handled by different invocations.
   */
  client: Pick<VeridAuthenticationClient, 'createSession' | 'finishSession'>;
}

/**
 * Scopes requested from VerID: `nin` makes the wallet disclose the national
 * identification number (BSN) as `nin.identifier`.
 */
const SCOPE = 'openid nin';

/**
 * Thin wrapper around the VerID OAuth (code + PKCE) client for the login and
 * callback steps of Mijn Nijmegen. Persons (BSN) only.
 */
export class VerIdAuthenticator {
  private readonly client: VerIdAuthenticatorProps['client'];

  constructor(props: VerIdAuthenticatorProps) {
    this.client = props.client;
  }

  /**
   * Start a login. The returned state must be stored in the user's session and
   * compared on the callback.
   */
  async start(): Promise<{ url: string; state: string }> {
    const { url, state } = await this.client.createSession({ scope: SCOPE });
    return { url, state };
  }

  /**
   * Finish a login: verify the callback belongs to this browser session, exchange the
   * code and return the BSN the wallet disclosed.
   *
   * @param callbackUrl the full callback url (with code and state)
   * @param expectedState the state stored in the session when the login was started
   */
  async finish(callbackUrl: URL, expectedState: string | undefined): Promise<Bsn> {
    if (!expectedState || callbackUrl.searchParams.get('state') !== expectedState) {
      throw Error('VerID callback state does not match the state of this session');
    }

    const result = await this.client.finishSession({ callbackUrl });
    if (result.format !== 'openid') {
      throw Error(`Unexpected VerID token format: ${result.format}`);
    }

    const nin = (result.payload as { nin?: { identifier?: string; identifier_type?: string } }).nin;
    if (nin?.identifier_type !== 'NL_BSN' || !nin.identifier) {
      throw Error('No BSN (nin of type NL_BSN) in VerID token');
    }
    return new Bsn(nin.identifier);
  }
}
