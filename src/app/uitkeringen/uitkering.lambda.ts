import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { uitkeringsRequestHandler } from './uitkeringsRequestHandler';

const dynamoDBClient = new DynamoDBClient();
const apiClient = new ApiClient();

async function init() {
  console.time('init');
  console.timeLog('init', 'start init');
  let promise = apiClient.init();
  console.timeEnd('init');
  return promise;
}

const initPromise = init();
const requestHandler = new uitkeringsRequestHandler({ apiClient, dynamoDBClient, showZaken: process.env.SHOW_ZAKEN == 'True' });

function parseEvent(event: APIGatewayProxyEventV2) {
  return {
    cookies: event?.cookies?.join(';') ?? '',
  };
}

exports.handler = async (event: any, _context: any) => {
  try {
    const params = parseEvent(event);
    await initPromise;
    return await requestHandler.handleRequest(params.cookies);

  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};
