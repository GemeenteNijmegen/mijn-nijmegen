import { DynamoDBClient, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'jest-aws-client-mock';
import * as lambda from '../index';

beforeAll(() => {
  global.console.log = jest.fn();
});

test('Return login page', async () => {
  const result = await lambda.handler({}, {});
  expect(result.statusCode).toBe(200);
});

test('No redirect if session cookie doesn\'t exist', async () => {
  const result = await lambda.handler({ cookies: ['demo=12345'] }, {});
  expect(result.statusCode).toBe(200);
});

test('Redirect to home if already logged in', async () => {
  const ddbMock = mockClient(DynamoDBClient);
  const output: Partial<GetItemCommandOutput> = {
    Item: {
      loggedin: {
        BOOL: true,
      },
    },
  };
  ddbMock.mockImplementation(() => output);
  const sessionId = '12345';
  const result = await lambda.handler({ cookies: [`session=${sessionId}`] }, {});
  expect(ddbMock).toHaveBeenCalledTimes(1);
  expect(ddbMock).toHaveBeenCalledWith(
    expect.objectContaining({
      input: {
        Key: {
          sessionid: { S: sessionId },
        },
        TableName: process.env.SESSION_TABLE,
      },
    }),
  );
  expect(result.statusCode).toBe(302);
});

test('Unknown session returns login page', async () => {
  const ddbMock = mockClient(DynamoDBClient);
  const output: Partial<GetItemCommandOutput> = {}; //empty output
  ddbMock.mockImplementation(() => output);
  const sessionId = '12345';
  const result = await lambda.handler({ cookies: [`session=${sessionId}`] }, {});
  expect(ddbMock).toHaveBeenCalledTimes(1);
  expect(result.statusCode).toBe(200);
});


test('DynamoDB error', async () => {
  const ddbMock = mockClient(DynamoDBClient);
  ddbMock.mockImplementation(() => { throw new Error('Not supported!'); });
  const result = await lambda.handler({ cookies: ['session=12345'] }, {});
  expect(ddbMock).toHaveBeenCalledTimes(1);
  expect(result.statusCode).toBe(200);
});