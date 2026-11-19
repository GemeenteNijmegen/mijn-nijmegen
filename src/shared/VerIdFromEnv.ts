import { AWS } from '@gemeentenijmegen/utils';
import { VerIdAuthenticator } from './VerIdAuthenticator';
import { createVerIdAuthenticator } from './VerIdAuthenticatorFactory';

/**
 * Build the VerID authenticator for the login and auth lambdas from their environment.
 *
 * Returns undefined when VerID is not enabled (`USE_YIVI_VERID` is not `true`) or when it
 * cannot be set up (e.g. the VerID parameters or secret are not filled in yet). A broken
 * VerID setup must never take down the other login methods: without an authenticator the
 * login page simply does not offer VerID and VerID callbacks are sent back to the login page.
 */
export async function verIdAuthenticatorFromEnv(): Promise<VerIdAuthenticator | undefined> {
  if (process.env.USE_YIVI_VERID !== 'true') {
    return undefined;
  }
  try {
    return createVerIdAuthenticator({
      issuerUri: process.env.VERID_ISSUER_URI!,
      clientId: process.env.VERID_CLIENT_ID!,
      clientSecret: await AWS.getSecret(process.env.VERID_CLIENT_SECRET_ARN!),
      redirectUri: process.env.VERID_REDIRECT_URL!,
      cacheTableName: process.env.VERID_CACHE_TABLE!,
      region: process.env.AWS_REGION,
    });
  } catch (error) {
    console.error('VerID is enabled but could not be set up, VerID login is not available', error);
    return undefined;
  }
}
