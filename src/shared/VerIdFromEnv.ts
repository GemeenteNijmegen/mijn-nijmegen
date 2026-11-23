import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { AWS } from '@gemeentenijmegen/utils';
import { DynamoDBCacheManager, VeridAuthenticationClient } from '@ver-id/node-client';
import { logger } from './Logger';
import { hasTestNin, VerIdAuthenticator } from './VerIdAuthenticator';

/**
 * Build the VerID authenticator for the login and auth lambdas from their environment.
 *
 * Returns undefined when the VerID flag (`USE_YIVI_VERID`) is off or when VerID cannot be
 * set up (e.g. parameters or secret not filled in yet). A broken VerID setup must never take
 * down the other login methods: without an authenticator Yivi uses Signicat (or is hidden when that flag is off).
 */
export async function verIdAuthenticatorFromEnv(): Promise<VerIdAuthenticator | undefined> {
  if (process.env.USE_YIVI_VERID !== 'true') {
    return undefined;
  }
  if (hasTestNin(process.env.VERID_SCOPE ?? '') && process.env.VERID_ALLOW_TEST_NIN !== 'true') {
    logger.error('VerID scope testNin (demo wallets) is not allowed in this environment, VerID login is not available');
    return undefined;
  }
  try {
    const client = new VeridAuthenticationClient({
      issuerUri: process.env.VERID_ISSUER_URI!,
      clientId: process.env.VERID_CLIENT_ID!,
      clientSecret: await AWS.getSecret(process.env.VERID_CLIENT_SECRET_ARN!),
      redirectUri: process.env.VERID_REDIRECT_URL!,
      // Keeps the PKCE verifier between the login and auth lambda, unfinished logins expire after 10 minutes
      cacheManager: new DynamoDBCacheManager({
        client: DynamoDBDocumentClient.from(new DynamoDBClient({})),
        tableName: process.env.VERID_CACHE_TABLE!,
        options: { ttlSeconds: 600 },
      }),
    });
    logger.debug('VerID authenticator ready', { scope: process.env.VERID_SCOPE, issuerUri: process.env.VERID_ISSUER_URI, clientId: process.env.VERID_CLIENT_ID, redirectUrl: process.env.VERID_REDIRECT_URL });
    return new VerIdAuthenticator({ client, scope: process.env.VERID_SCOPE });
  } catch (error) {
    logger.error('VerID is enabled but could not be set up, VerID login is not available', { error });
    return undefined;
  }
}
