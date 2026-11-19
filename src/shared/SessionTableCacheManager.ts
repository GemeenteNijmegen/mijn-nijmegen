import { DeleteItemCommand, DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import type { ICacheManager } from '@ver-id/node-client';

/**
 * Stores the PKCE verifiers of VerID logins in the existing sessions table, so the login and auth
 * lambda can share them. The rows use a `verid:` prefixed `sessionid` (real session ids are hashes,
 * so they cannot collide) and the same epoch-seconds `ttl` attribute as the sessions, so
 * unfinished logins are removed by the table's TTL.
 */
export class SessionTableCacheManager implements ICacheManager {
  constructor(
    private readonly client: DynamoDBClient,
    private readonly tableName: string,
    private readonly ttlSeconds: number,
  ) {}

  private key(key: string) {
    return { sessionid: { S: `verid:${key}` } };
  }

  async save(key: string, value: string): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    await this.client.send(new PutItemCommand({
      TableName: this.tableName,
      Item: { ...this.key(key), value: { S: value }, ttl: { N: String(ttl) } },
    }));
  }

  async get(key: string): Promise<string | null> {
    const { Item } = await this.client.send(new GetItemCommand({ TableName: this.tableName, Key: this.key(key) }));
    // DynamoDB removes expired items with a delay, so check the ttl ourselves
    if (!Item?.value?.S || Number(Item.ttl?.N) * 1000 <= Date.now()) {
      return null;
    }
    return Item.value.S;
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteItemCommand({ TableName: this.tableName, Key: this.key(key) }));
  }
}
