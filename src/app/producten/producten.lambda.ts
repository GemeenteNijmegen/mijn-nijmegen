import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';

export async function handler(event: any, _context: any):Promise<ApiGatewayV2Response> {


  return Response.error(412);
}