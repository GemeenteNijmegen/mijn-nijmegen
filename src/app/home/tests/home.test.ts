import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { homeRequestHandler } from '../homeRequestHandler';

beforeAll(() => {

  if (process.env.VERBOSETESTS!='True') {
    global.console.error = jest.fn();
    global.console.time = jest.fn();
    global.console.log = jest.fn();
  }
  // Set env variables
  process.env.SESSION_TABLE = 'mijnuitkering-sessions';
  process.env.APPLICATION_URL_BASE = 'https://testing.example.com/';
});


const ddbMock = mockClient(DynamoDBClient);

beforeEach(() => {
  ddbMock.reset();
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      data: {
        M: {
          loggedin: { BOOL: true },
          bsn: { S: '12345678' },
          state: { S: '12345' },
          username: { S: 'Jan de Tester' },
        },
      },
    },
  };
  ddbMock.on(GetItemCommand).resolves(getItemOutput);
});

test('Returns 200', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const result = await homeRequestHandler('session=12345', dynamoDBClient);

  expect(result.statusCode).toBe(200);
  let cookies = result?.cookies?.filter((cookie: string) => cookie.indexOf('HttpOnly; Secure'));
  expect(cookies?.length).toBe(1);
});

test('Shows overview page', async () => {
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const result = await homeRequestHandler('session=12345', dynamoDBClient);
  expect(result.body).toMatch('Mijn Nijmegen');
  expect(result.body).toMatch('Jan de Tester');
});