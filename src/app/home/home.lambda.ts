import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { HomeRequestHandler } from './homeRequestHandler';
import { logger } from '../../shared/Logger';

const dynamoDBClient = new DynamoDBClient({});
const requestHandler = new HomeRequestHandler(dynamoDBClient);

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

export async function handler(event: any, context?: Context): Promise<ApiGatewayV2Response> {
  context && logger.addContext(context);
  try {
    const params = parseEvent(event);
    return await requestHandler.handleRequest(params);

  } catch (err) {
    logger.error('Error occurred while handling home request', { error: err });
    return Response.error(500);
  }
};
