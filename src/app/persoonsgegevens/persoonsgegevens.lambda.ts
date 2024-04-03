import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { PersoonsgegevensRequestHandler } from './persoonsgegevensRequestHandler';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const apiClient = new ApiClient();

async function init() {
  console.time('init');
  console.timeLog('init', 'start init');
  let promise = apiClient.init();
  console.timeEnd('init');
  return promise;
}

const initPromise = init();
const requestHandler = new PersoonsgegevensRequestHandler({ apiClient, dynamoDBClient, showZaken: process.env.SHOW_ZAKEN == 'True' });

function parseEvent(event: APIGatewayProxyEventV2): any {
  return {
    cookies: event?.cookies?.join(';'),
  };
}

export async function handler(event: any, _context: any):Promise<ApiGatewayV2Response> {
  try {
    const params = parseEvent(event);
    await initPromise;
    return await requestHandler.handleRequest(params.cookies);

  } catch (err) {
    console.debug(err);
    return Response.error(500);
  }
};
