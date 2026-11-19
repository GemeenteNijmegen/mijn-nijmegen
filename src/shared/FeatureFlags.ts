import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

interface FeatureFlagsOptions {
  ssmClient?: SSMClient;
  /** How long a successfully read value is cached, in milliseconds. Default 60000. */
  ttlMs?: number;
  /** Give up on SSM after this many milliseconds and use the default. Default 1000. */
  timeoutMs?: number;
  /** Clock, injectable for tests. */
  now?: () => number;
}

interface CacheEntry {
  value: boolean;
  expiresAt: number;
}

/**
 * Reads boolean feature flags from SSM parameters at runtime, so a flag can be changed
 * without a redeploy. Values are cached in memory; failures are never cached and fall back
 * to the supplied default so a broken or missing parameter cannot take login down.
 */
export class FeatureFlags {
  private readonly ssmClient: SSMClient;
  private readonly ttlMs: number;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options?: FeatureFlagsOptions) {
    this.ssmClient = options?.ssmClient ?? new SSMClient({ region: process.env.AWS_REGION, maxAttempts: 2 });
    this.timeoutMs = options?.timeoutMs ?? 1_000;
    this.ttlMs = options?.ttlMs ?? 60_000;
    this.now = options?.now ?? Date.now;
  }

  async isEnabled(parameterName: string, defaultValue: boolean): Promise<boolean> {
    const cached = this.cache.get(parameterName);
    if (cached && this.now() < cached.expiresAt) {
      return cached.value;
    }

    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${this.timeoutMs}ms`)), this.timeoutMs);
      });
      const result = await Promise.race([
        this.ssmClient.send(new GetParameterCommand({ Name: parameterName })),
        timeout,
      ]);
      const value = result.Parameter?.Value?.trim().toLowerCase() === 'true';
      this.cache.set(parameterName, { value, expiresAt: this.now() + this.ttlMs });
      return value;
    } catch (error) {
      console.warn(`Could not read feature flag ${parameterName}, using default ${defaultValue}`, error);
      return defaultValue;
    } finally {
      clearTimeout(timer);
    }
  }
}
