import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'jest-aws-client-mock';
import { Session } from '../shared/Session';

beforeAll(() => {
  process.env.SESSION_TABLE = 'mijnuitkering-sessions';
});

const ddbMock = mockClient(DynamoDBClient);

beforeEach(() => {
  ddbMock.mockReset();
});

test('Empty session cookie will not update session', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const session = new Session('session=;', dynamoDBClient);
  if (await session.init()) {
    await session.updateSession(false);
  }

  expect(ddbMock).toHaveBeenCalledTimes(0);
});

test('No session cookie will not update session', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const session = new Session('', dynamoDBClient);
  await session.init();
  if (session.sessionId !== false) {
    await session.updateSession(false);
  }
  expect(ddbMock).toHaveBeenCalledTimes(0);
});

test('No session cookie will not update session', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const session = new Session('', dynamoDBClient);
  await session.init();
  if (session.sessionId !== false) {
    await session.updateSession(false);
  }
  expect(ddbMock).toHaveBeenCalledTimes(0);
});