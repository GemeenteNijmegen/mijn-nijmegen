import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { AuthRequestHandler } from './AuthRequestHandler';
import { OurOwnIdentityProvider } from './IdentityProvider';
import { OpenIDConnect } from '../../shared/OpenIDConnect';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const apiClient = new ApiClient();
const OIDC = new OpenIDConnect();

// This is proof of cocept the API is actually secured with an classical API key
const idp = new OurOwnIdentityProvider('https://auth-service.sandbox-01.csp-nijmegen.nl', '0588239d-3fb8-42af-9f0a-96cbfe199a8e', 'cf8ac7cf-dea8-414a-b37d-c00813778d41');

function parseEvent(event: any) {
  return {
    cookies: event?.cookies?.join(';'),
    code: event?.queryStringParameters?.code,
    state: event?.queryStringParameters?.state,
  };
}

export async function handler(event: any, _context: any):Promise<ApiGatewayV2Response> {
  try {
    const params = parseEvent(event);
    const requestHandler = new AuthRequestHandler({
      cookies: params.cookies,
      queryStringParamCode: params.code,
      queryStringParamState: params.state,
      dynamoDBClient,
      apiClient,
      idp,
      OpenIdConnect: OIDC,
      digidScope: process.env.DIGID_SCOPE ?? '',
      eherkenningScope: process.env.EHERKENNING_SCOPE ?? '',
      yiviScope: process.env.YIVI_SCOPE ?? '',
      yiviBsnAttribute: process.env.YIVI_BSN_ATTRIBUTE ?? '',
      yiviKvkNumberAttribute: process.env.YIVI_KVK_NUMBER_ATTRIBUTE ?? '',
      yiviKvkNameAttribute: process.env.YIVI_KVK_NAME_ATTRIBUTE ?? '',
      useYiviKvk: process.env.USE_YIVI_KVK === 'true',
    });
    return await requestHandler.handleRequest();
  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
}
