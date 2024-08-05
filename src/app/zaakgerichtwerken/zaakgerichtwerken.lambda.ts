import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

// function parseEvent(event: APIGatewayProxyEventV2) {
//   return {
//   };
// }

export async function handler (_event: APIGatewayProxyEventV2, _context: any):Promise<ApiGatewayV2Response> {
  try {
    // const params = parseEvent(event);
    return Response.ok();

  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};
