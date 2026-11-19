import { DeleteItemCommand, DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { SessionTableCacheManager } from '../SessionTableCacheManager';

const ddbMock = mockClient(DynamoDBClient);
const NOW_MS = 1_700_000_000_000;
const NOW_S = NOW_MS / 1000;

function cacheManager() {
  return new SessionTableCacheManager(new DynamoDBClient({ region: 'eu-west-1' }), 'sessions', 600);
}

beforeEach(() => {
  ddbMock.reset();
  jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SessionTableCacheManager', () => {
  test('save writes a prefixed sessionid, the value and a ttl in epoch seconds', async () => {
    await cacheManager().save('state-1', 'verifier');
    expect(ddbMock.commandCalls(PutItemCommand)[0].args[0].input).toEqual({
      TableName: 'sessions',
      Item: {
        sessionid: { S: 'verid:state-1' },
        value: { S: 'verifier' },
        ttl: { N: String(NOW_S + 600) },
      },
    });
  });

  test('get returns the stored value', async () => {
    ddbMock.on(GetItemCommand).resolves({ Item: { sessionid: { S: 'verid:state-1' }, value: { S: 'verifier' }, ttl: { N: String(NOW_S + 10) } } });
    expect(await cacheManager().get('state-1')).toBe('verifier');
    expect(ddbMock.commandCalls(GetItemCommand)[0].args[0].input).toEqual({
      TableName: 'sessions',
      Key: { sessionid: { S: 'verid:state-1' } },
    });
  });

  test('get returns null when there is no item', async () => {
    ddbMock.on(GetItemCommand).resolves({});
    expect(await cacheManager().get('state-1')).toBeNull();
  });

  test('get returns null for an expired item that DynamoDB has not removed yet', async () => {
    ddbMock.on(GetItemCommand).resolves({ Item: { sessionid: { S: 'verid:state-1' }, value: { S: 'verifier' }, ttl: { N: String(NOW_S - 1) } } });
    expect(await cacheManager().get('state-1')).toBeNull();
  });

  test('get does not return a regular session (no value attribute)', async () => {
    ddbMock.on(GetItemCommand).resolves({ Item: { sessionid: { S: 'verid:state-1' }, data: { M: {} }, ttl: { N: String(NOW_S + 10) } } });
    expect(await cacheManager().get('state-1')).toBeNull();
  });

  test('remove deletes the prefixed item', async () => {
    await cacheManager().remove('state-1');
    expect(ddbMock.commandCalls(DeleteItemCommand)[0].args[0].input).toEqual({
      TableName: 'sessions',
      Key: { sessionid: { S: 'verid:state-1' } },
    });
  });
});
