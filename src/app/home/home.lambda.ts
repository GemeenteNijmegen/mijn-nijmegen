import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { HomeRequestHandler } from './homeRequestHandler';

const dynamoDBClient = new DynamoDBClient({});
const requestHandler = new HomeRequestHandler(dynamoDBClient, { showZaken: process.env.SHOW_ZAKEN == 'True' });

export interface eventParams {
  cookies: string;
  xsrfToken?: string;
  responseType: 'json' | 'html';
}

function parseEvent(event: APIGatewayProxyEventV2): eventParams {
  return {
    cookies: event?.cookies?.join(';') ?? '',
    responseType: event?.headers?.accept == 'application/json' ? 'json' : 'html',
  };
}

export async function handler (event: any, _context: any):Promise<ApiGatewayV2Response> {
  try {
    const params = parseEvent(event);
    return await requestHandler.handleRequest(params);

  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};
