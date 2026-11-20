import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDBCacheManager, VeridAuthenticationClient } from '@ver-id/node-client';
import { VerIdAuthenticator } from './VerIdAuthenticator';

export interface VerIdAuthenticatorConfig {
  /** VerID OAuth issuer URI (from the authentication flow in VerID Studio) */
  issuerUri: string;
  /** The authentication flow id (used as OAuth client id) */
  clientId: string;
  clientSecret: string;
  /** Redirect URI registered on the flow: our `/auth` endpoint */
  redirectUri: string;
  /**
   * DynamoDB table (partition key `pk` String, TTL attribute `ttl`) that keeps the PKCE
   * verifiers between the login and callback lambda invocations.
   */
  cacheTableName: string;
  region?: string;
}

/** Unfinished logins are forgotten after 10 minutes */
const VERIFIER_TTL_SECONDS = 600;

/**
 * Create a VerIdAuthenticator backed by the real VerID client and a DynamoDB verifier store
 */
export function createVerIdAuthenticator(config: VerIdAuthenticatorConfig): VerIdAuthenticator {
  const client = new VeridAuthenticationClient({
    issuerUri: config.issuerUri,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    cacheManager: new DynamoDBCacheManager({
      client: DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region })),
      tableName: config.cacheTableName,
      options: { ttlSeconds: VERIFIER_TTL_SECONDS },
    }),
  });
  return new VerIdAuthenticator({ client });
}
