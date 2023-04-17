import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { homeRequestHandler } from './homeRequestHandler';

const dynamoDBClient = new DynamoDBClient({});

function parseEvent(event: any) {
  return {
    cookies: event?.cookies?.join(';'),
  };
}

export async function handler (event: any, _context: any):Promise<ApiGatewayV2Response> {
  try {
    const params = parseEvent(event);
    return await homeRequestHandler(params.cookies, dynamoDBClient);

  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};