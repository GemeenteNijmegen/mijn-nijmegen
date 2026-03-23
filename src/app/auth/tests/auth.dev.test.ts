import { DynamoDBClient, GetItemCommand, GetItemCommandOutput, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { NoAuthRequestHandler } from '../NoAuthRequestHandler';

const ddbMock = mockClient(DynamoDBClient);
const sessionId = '12345';

beforeAll(() => {
  process.env.SESSION_TABLE = 'mijnuitkering-sessions';
});

beforeEach(() => {
  ddbMock.reset();
});

function setupSessionResponse(loggedin: boolean) {
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      data: {
        M: {
          loggedin: { BOOL: loggedin },
          bsn: { S: '999990019' },
          state: { S: '12345' },
        },
      },
    },
  };
  ddbMock.on(GetItemCommand).resolves(getItemOutput);
}

describe('NoAuthRequestHandler', () => {
  test('Redirects to home on success', async () => {
    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
    setupSessionResponse(true);

    const handler = new NoAuthRequestHandler({
      dynamoDBClient,
      params: { cookies: `session=${sessionId}`, bsn: '999990019' },
    });

    const result = await handler.handleRequest();
    expect(result.statusCode).toBe(302);
    expect(result?.headers?.Location).toBe('/');
  });

  test('Sets session cookie on redirect', async () => {
    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
    setupSessionResponse(false);

    const handler = new NoAuthRequestHandler({
      dynamoDBClient,
      params: { cookies: `session=${sessionId}`, bsn: '999990019' },
    });

    const result = await handler.handleRequest();
    expect(result.statusCode).toBe(302);
    expect(result.cookies).toContainEqual(expect.stringContaining('session='));
  });

  test('No session redirects to login', async () => {
    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
    // No setupSessionResponse call — DynamoDB returns nothing, session.init() gets no session
    ddbMock.on(GetItemCommand).resolves({});

    const handler = new NoAuthRequestHandler({
      dynamoDBClient,
      params: { cookies: '', bsn: '999990019' },
    });

    const result = await handler.handleRequest();
    expect(result.statusCode).toBe(302);
    expect(result?.headers?.Location).toBe('/login');
  });

  test('Uses BSN from constructor prop', async () => {
    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
    setupSessionResponse(false);
    ddbMock.on(PutItemCommand).resolves({});

    const handler = new NoAuthRequestHandler({
      dynamoDBClient,
      params: { cookies: `session=${sessionId}`, bsn: '999990019' },
    });

    await handler.handleRequest();

    const putCall = ddbMock.commandCalls(PutItemCommand)[0];
    const storedData = putCall.args[0].input.Item?.data?.M;
    expect(storedData?.bsn?.S).toBe('999990019');
    expect(storedData?.identifier?.S).toBe('999990019');
  });

  test('Session data contains expected fields', async () => {
    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
    setupSessionResponse(false);
    ddbMock.on(PutItemCommand).resolves({});

    const handler = new NoAuthRequestHandler({
      dynamoDBClient,
      params: { cookies: `session=${sessionId}`, bsn: '999990019' },
    });

    await handler.handleRequest();

    const putCall = ddbMock.commandCalls(PutItemCommand)[0];
    const storedData = putCall.args[0].input.Item?.data?.M;

    expect(storedData?.loggedin?.BOOL).toBe(true);
    expect(storedData?.identifier?.S).toBe('999990019');
    expect(storedData?.bsn?.S).toBe('999990019');
    expect(storedData?.user_type?.S).toBe('person');
    expect(storedData?.username?.S).toContain('999990019');
    expect(storedData?.xsrf_token?.S).toBeTruthy();
  });

});
