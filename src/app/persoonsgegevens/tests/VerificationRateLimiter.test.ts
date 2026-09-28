import { ConditionalCheckFailedException, DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { VerificationRateLimiter } from '../VerificationRateLimiter';

const ddbMock = mockClient(DynamoDBClient);

beforeEach(() => {
  ddbMock.reset();
});

describe('VerificationRateLimiter', () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-central-1' });

  test('allows the request when the update succeeds', async () => {
    ddbMock.on(UpdateItemCommand).resolves({});
    const limiter = new VerificationRateLimiter({ dynamoDBClient, tableName: 'test-table' });

    const outcome = await limiter.consume('session-hash', 'email', 'issue', 5);

    expect(outcome.allowed).toBe(true);
    expect(outcome.retryAfterSeconds).toBeGreaterThan(0);
  });

  test('denies the request without throwing when the condition check fails', async () => {
    ddbMock.on(UpdateItemCommand).rejects(
      new ConditionalCheckFailedException({ message: 'exceeded', $metadata: {} }),
    );
    const limiter = new VerificationRateLimiter({ dynamoDBClient, tableName: 'test-table' });

    const outcome = await limiter.consume('session-hash', 'email', 'verify', 5);

    expect(outcome.allowed).toBe(false);
    expect(outcome.remaining).toBe(0);
  });

  test('reports remaining slots from the count DynamoDB returns', async () => {
    ddbMock.on(UpdateItemCommand).resolves({ Attributes: { count: { N: '2' } } });
    const limiter = new VerificationRateLimiter({ dynamoDBClient, tableName: 'test-table' });

    const outcome = await limiter.consume('session-hash', 'email', 'verify', 5);

    expect(outcome.remaining).toBe(3);
  });

  test('propagates unexpected errors (fail closed)', async () => {
    ddbMock.on(UpdateItemCommand).rejects(new Error('DynamoDB is unavailable'));
    const limiter = new VerificationRateLimiter({ dynamoDBClient, tableName: 'test-table' });

    await expect(limiter.consume('session-hash', 'email', 'issue', 5)).rejects.toThrow('DynamoDB is unavailable');
  });

  test('sends the expected key, condition and values', async () => {
    ddbMock.on(UpdateItemCommand).resolves({});
    const limiter = new VerificationRateLimiter({ dynamoDBClient, tableName: 'test-table', windowMs: 60 * 60 * 1000 });

    await limiter.consume('abc123', 'phonenumber', 'verify', 5);

    const call = ddbMock.commandCalls(UpdateItemCommand)[0];
    const input = call.args[0].input;

    expect(input.TableName).toBe('test-table');
    expect(input.Key?.sessionid.S).toMatch(/^ratelimit#verify#phonenumber#abc123#\d+$/);
    expect(input.ConditionExpression).toBe('attribute_not_exists(#count) OR #count < :max');
    expect(input.UpdateExpression).toBe('ADD #count :incr SET #ttl = :ttl');
    expect(input.ExpressionAttributeValues?.[':max'].N).toBe('5');
    expect(input.ExpressionAttributeValues?.[':incr'].N).toBe('1');
  });

  test('max must be positive', async () => {
    const limiter = new VerificationRateLimiter({ dynamoDBClient, tableName: 'test-table' });
    await expect(limiter.consume('session-hash', 'email', 'issue', 0)).rejects.toThrow('max must be positive, got 0');
  });

  test('uses independent buckets across a window boundary', async () => {
    ddbMock.on(UpdateItemCommand).resolves({});
    const limiter = new VerificationRateLimiter({ dynamoDBClient, tableName: 'test-table', windowMs: 50 });

    const realNow = Date.now;
    try {
      Date.now = () => 1000;
      await limiter.consume('session-hash', 'email', 'issue', 5);

      Date.now = () => 1100; // two 50ms windows later
      await limiter.consume('session-hash', 'email', 'issue', 5);
    } finally {
      Date.now = realNow;
    }

    const calls = ddbMock.commandCalls(UpdateItemCommand);
    const firstKey = calls[0].args[0].input.Key?.sessionid.S;
    const secondKey = calls[1].args[0].input.Key?.sessionid.S;
    expect(firstKey).not.toBe(secondKey);
  });

  test('config.windowMs must be positive', async () => {
    ddbMock.on(GetItemCommand).resolves({});
    expect(() => new VerificationRateLimiter({ dynamoDBClient, tableName: 'test-table', windowMs: -1 })).toThrow('config.windowMs must be positive, got -1');
  });

  test('resolves the table name from SESSION_TABLE when not explicitly provided', async () => {
    const original = process.env.SESSION_TABLE;
    process.env.SESSION_TABLE = 'env-table';
    try {
      ddbMock.on(UpdateItemCommand).resolves({});
      const limiter = new VerificationRateLimiter({ dynamoDBClient });

      await limiter.consume('session-hash', 'email', 'issue', 5);

      expect(ddbMock.commandCalls(UpdateItemCommand)[0].args[0].input.TableName).toBe('env-table');
    } finally {
      process.env.SESSION_TABLE = original;
    }
  });

  test('throws when no table name is available', () => {
    const original = process.env.SESSION_TABLE;
    delete process.env.SESSION_TABLE;
    try {
      expect(() => new VerificationRateLimiter({ dynamoDBClient })).toThrow(
        'No table name provided and SESSION_TABLE env var is not set',
      );
    } finally {
      process.env.SESSION_TABLE = original;
    }
  });

  test('remaining() reads the current count without consuming a slot', async () => {
    ddbMock.on(GetItemCommand).resolves({ Item: { count: { N: '2' } } });
    const limiter = new VerificationRateLimiter({ dynamoDBClient, tableName: 'test-table' });

    const remaining = await limiter.remaining('session-hash', 'email', 'verify', 5);

    expect(remaining).toBe(3);
    expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(0);
  });

  test('remaining() defaults to the full budget when no item exists yet', async () => {
    ddbMock.on(GetItemCommand).resolves({});
    const limiter = new VerificationRateLimiter({ dynamoDBClient, tableName: 'test-table' });

    const remaining = await limiter.remaining('session-hash', 'email', 'verify', 5);

    expect(remaining).toBe(5);
  });


});
