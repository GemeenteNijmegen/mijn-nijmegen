import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http';
import { AWS } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

function parseEvent(event: APIGatewayProxyEventV2) {
  return {
    apikey: event.headers['x-api-key'],
  };
}

export async function handler (event: APIGatewayProxyEventV2, _context: any):Promise<ApiGatewayV2Response> {
  if (!process.env.API_KEY_ARN) {
    return Response.error(500);
  }
  const apikey = await AWS.getSecret(process.env.API_KEY_ARN);
  try {
    const params = parseEvent(event);
    if (params.apikey !== apikey) {
      return Response.error(401);
    }
    return Response.ok();
  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};
