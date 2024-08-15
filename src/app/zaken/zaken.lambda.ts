import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ZakenRequestHandler } from './zakenRequestHandler';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });

let sharedRequestHandler: ZakenRequestHandler;

async function sharedZakenRequestHandler() {
  if (!sharedRequestHandler) {
    sharedRequestHandler = new ZakenRequestHandler(dynamoDBClient);
  }
  return sharedRequestHandler;
}

function parseEvent(event: APIGatewayProxyEventV2): { cookies: string; zaakId?: string; zaakConnectorId?: string; file?: string } {
  if (!event.cookies) {
    throw Error('no cookies in event');
  }
  return {
    zaakConnectorId: event?.pathParameters?.zaaksource,
    zaakId: event?.pathParameters?.zaakid,
    file: event?.pathParameters?.file,
    cookies: event.cookies.join(';'),
  };
}

export async function handler(event: any, _context: any):Promise<ApiGatewayV2Response> {
  try {
    const params = parseEvent(event);
    const requestHandler = await sharedZakenRequestHandler();
    return await requestHandler.handleRequest(params.cookies, params.zaakConnectorId, params.zaakId, params.file);
  } catch (err) {
    console.debug(err);
    return Response.error(500);
  }
}
