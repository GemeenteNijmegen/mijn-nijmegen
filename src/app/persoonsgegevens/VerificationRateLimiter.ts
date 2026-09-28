import { ConditionalCheckFailedException, DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

export type VerificationRateLimitScope = 'issue' | 'verify';

export interface RateLimitOutcome {
  allowed: boolean;
  /** Seconds until the current window fully expires (for messaging / Retry-After). */
  retryAfterSeconds: number;
  /** Slots left in the current window after this call. 0 when denied. */
  remaining: number;
}

export interface VerificationRateLimiterConfig {
  dynamoDBClient: DynamoDBClient;
  /** Defaults to process.env.SESSION_TABLE, the same table @gemeentenijmegen/session uses. */
  tableName?: string;
  /** Overridable for tests; defaults to 1 hour. */
  windowMs?: number;
}

/**
 * Rate limiter for verification code issuance and verification attempts,
 * using atomic fixed-window counters. Each counter is stored as a
 * separate item in the sessions table (key prefixed with `ratelimit#`),
 * so the session package's blind full-item overwrites never touch it.
 */
export class VerificationRateLimiter {
  private readonly windowMs: number;
  private readonly tableName: string;

  constructor(private config: VerificationRateLimiterConfig) {
    if (config.windowMs !== undefined && config.windowMs <= 0) {
      throw new Error(`config.windowMs must be positive, got ${config.windowMs}`);
    }
    this.windowMs = config.windowMs ?? 60 * 60 * 1000;
    const tableName = config.tableName ?? process.env.SESSION_TABLE;
    if (!tableName) {
      throw new Error('No table name provided and SESSION_TABLE env var is not set');
    }
    this.tableName = tableName;
  }

  /**
   * Atomically attempts to consume one slot out of `max` for
   * (accountKey, type, scope) in the current fixed time window.
   *
   * `accountKey` is `session.sessionHash` for now (session-scoped limits,
   * since all login methods are already 2FA). Pass
   * `session.getValue('identifier')` instead to upgrade to account-wide,
   * cross-session limits later. No other change is needed.
   */
  async consume(accountKey: string, type: string, scope: VerificationRateLimitScope, max: number): Promise<RateLimitOutcome> {
    if (max <= 0) {
      throw new Error(`max must be positive, got ${max}`);
    }

    const { rateLimitKey, ttlEpochSeconds, retryAfterSeconds } = this.window(accountKey, type, scope);
    try {
      const response = await this.config.dynamoDBClient.send(new UpdateItemCommand({
        TableName: this.tableName,
        Key: { sessionid: { S: rateLimitKey } },
        UpdateExpression: 'ADD #count :incr SET #ttl = :ttl',
        ConditionExpression: 'attribute_not_exists(#count) OR #count < :max',
        ExpressionAttributeNames: { '#count': 'count', '#ttl': 'ttl' },
        ExpressionAttributeValues: {
          ':incr': { N: '1' },
          ':max': { N: String(max) },
          ':ttl': { N: String(ttlEpochSeconds) },
        },
        ReturnValues: 'UPDATED_NEW',
      }));
      // DynamoDB always returns Attributes here on a successful conditional
      // update with ReturnValues: 'UPDATED_NEW'. The fallback only matters
      // for callers whose mocked/stubbed response omits it; `remaining` is
      // purely informational (the ConditionExpression already enforced the
      // limit), so assume the smallest plausible usage rather than the max.
      const count = response?.Attributes?.count?.N ? parseInt(response.Attributes.count.N, 10) : 1;
      return { allowed: true, retryAfterSeconds, remaining: Math.max(0, max - count) };
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return { allowed: false, retryAfterSeconds, remaining: 0 };
      }
      throw error; // Fail closed. Propagate unexpected DynamoDB errors instead of silently allowing.
    }
  }

  /**
   * Reads the current remaining count for (accountKey, type, scope) without
   * consuming a slot. Used to display a live count (e.g. "attempts left")
   * on a page load, which should not itself count as an attempt.
   */
  async remaining(accountKey: string, type: string, scope: VerificationRateLimitScope, max: number): Promise<number> {
    const { rateLimitKey } = this.window(accountKey, type, scope);
    const response = await this.config.dynamoDBClient.send(new GetItemCommand({
      TableName: this.tableName,
      Key: { sessionid: { S: rateLimitKey } },
      ConsistentRead: true,
    }));
    // DynamoDB returns undefined for missing items, so default to 0 if the item doesn't exist or the count attribute is missing.
    const count = response.Item?.count?.N ? parseInt(response.Item.count.N, 10) : 0;
    return Math.max(0, max - count);
  }

  private window(accountKey: string, type: string, scope: VerificationRateLimitScope) {
    const now = Date.now();
    const windowBucket = Math.floor(now / this.windowMs);
    const windowEndMs = (windowBucket + 1) * this.windowMs;
    return {
      rateLimitKey: `ratelimit#${scope}#${type}#${accountKey}#${windowBucket}`,
      ttlEpochSeconds: Math.floor(windowEndMs / 1000) + 300,
      retryAfterSeconds: Math.max(1, Math.ceil((windowEndMs - now) / 1000)),
    };
  }
}
