import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { inzageRequestHandler } from './inzageRequestHandler';

const dynamoDBClient: DynamoDBClient = new DynamoDBClient();
const apiClient: ApiClient = new ApiClient();

async function init(): Promise<void> {
  let promise: Promise<void> = apiClient.init();
  return promise;
}

const initPromise: Promise<void> = init();

function parseEvent(event: any) {
  const lastWeek: Date = new Date();
  lastWeek.setDate(new Date().getDate()-7);
  return {
    cookies: event?.cookies?.join(';'),
    startdate: event?.queryStringParameters?.['date-start'] ?? new Date().toISOString(),
    enddate: event?.queryStringParameters?.['date-end'] ?? lastWeek.toISOString(),
  };
}

export async function handler(event: any, context: any): Promise<any> { //ipv event: any --> https://www.npmjs.com/package/@types/aws-lambda
  try {
    console.debug(event);
    const params = parseEvent(event);
    console.debug(params);
    await initPromise;
    return await inzageRequestHandler(params.cookies, { startdate: params.startdate, enddate: params.enddate }, apiClient, dynamoDBClient);

  } catch (err) {
    console.debug(err);
    const response: { statusCode: number } = {
      statusCode: 500,
    };
    return response;
  }
}