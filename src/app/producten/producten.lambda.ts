import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ProductenRequestHandler } from './productenRequestHandler';

export interface productEventParams {
  cookies: string;
  productId?: string;
  file?: string;
  xsrfToken?: string;
  responseType: 'json' | 'html';
  inladenWallet?: boolean;
  isIngeladenWallet?: boolean;
}


const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });
function parseEvent(event: APIGatewayProxyEventV2): any {
  return {
    cookies: event?.cookies?.join(';'),
    productId: event?.pathParameters?.productid,
    xsrfToken: event?.headers?.xsrftoken,
    responseType: event?.headers?.accept == 'application/json' ? 'json' : 'html',
    inladenWallet: event?.queryStringParameters?.inladen_wallet == 'true' ? true : false,
    isIngeladenWallet: event?.queryStringParameters?.is_ingeladen_wallet == 'true' ? true : false,
  };
}

export async function handler(event: any, _context: any):Promise<ApiGatewayV2Response> {
  try {
    const params = parseEvent(event);

    const requestHandler = new ProductenRequestHandler({
      dynamoDBClient,
    });

    return await requestHandler.handleRequest(params.cookies, params);

  } catch (err) {
    console.debug(err);
    return Response.error(500);
  }
}