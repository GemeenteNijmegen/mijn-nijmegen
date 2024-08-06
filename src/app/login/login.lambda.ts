import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { LoginRequestHandler } from './loginRequestHandler';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });

if (!process.env.OIDC_SCOPE || !process.env.DIGID_SCOPE) {
  throw Error('No OIDC_SCOPE or DIGID_SCOPE env. param provided');
}
const loginRequestHandler = new LoginRequestHandler({
  oidcScope: process.env.OIDC_SCOPE ?? '',
  digidScope: process.env.DIGID_SCOPE ?? '',
  yiviScope: process.env.YIVI_SCOPE,
  yiviBsnAttribute: process.env.YIVI_BSN_ATTRIBUTE,
  yiviCondisconScope: process.env.YIVI_CONDISCON_SCOPE,
  eHerkenningScope: process.env.EHERKENNING_SCOPE ?? '',
  useYiviKvk: process.env.USE_YIVI_KVK == 'true',
});

function parseEvent(event: any) {
  return { cookies: event?.cookies?.join(';') };
}

export async function handler (event: any, _context: any):Promise<ApiGatewayV2Response> {
  try {
    const params = parseEvent(event);
    const response = await loginRequestHandler.handleRequest(params.cookies, dynamoDBClient);
    return response;
  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};
