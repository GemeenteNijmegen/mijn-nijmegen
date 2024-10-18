import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { AWS } from '@gemeentenijmegen/utils';
import { AuthenticationService } from './AuthenticationService';
import { AuthRequestHandler } from './AuthRequestHandler';
import { OpenIDConnect } from '../../shared/OpenIDConnect';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const apiClient = new ApiClient();
const OIDC = new OpenIDConnect();

// This is proof of cocept the API is actually secured with an classical API key
let authenticationService: AuthenticationService | undefined = undefined;
async function init() {
  if (process.env.USE_AUTH_SERVICE === 'true') {
    const clientSecret = await AWS.getSecret(process.env.AUTH_SERVICE_CLIENT_SECRET_ARN!);
    authenticationService = new AuthenticationService(process.env.AUTH_SERVICE_ENDPOINT!, process.env.AUTH_SERVICE_CLIENT_ID!, clientSecret);
  }
}
const initaliation = init();

function parseEvent(event: any) {
  return {
    cookies: event?.cookies?.join(';'),
    code: event?.queryStringParameters?.code,
    state: event?.queryStringParameters?.state,
  };
}

export async function handler(event: any, _context: any):Promise<ApiGatewayV2Response> {
  await initaliation;

  try {
    const params = parseEvent(event);
    const requestHandler = new AuthRequestHandler({
      cookies: params.cookies,
      queryStringParamCode: params.code,
      queryStringParamState: params.state,
      dynamoDBClient,
      apiClient,
      authenticationService: authenticationService,
      OpenIdConnect: OIDC,
      digidScope: process.env.DIGID_SCOPE ?? '',
      eherkenningScope: process.env.EHERKENNING_SCOPE ?? '',
      yiviScope: process.env.YIVI_SCOPE ?? '',
      yiviBsnAttribute: process.env.YIVI_BSN_ATTRIBUTE ?? '',
      yiviKvkNumberAttribute: process.env.YIVI_KVK_NUMBER_ATTRIBUTE ?? '',
      yiviKvkNameAttribute: process.env.YIVI_KVK_NAME_ATTRIBUTE ?? '',
      useYiviKvk: process.env.USE_YIVI_KVK === 'true',
      useNlWalletVerId: process.env.USE_NL_WALLET_VERID === 'true',
      useNlWalletSignicat: process.env.USE_NL_WALLET_SIGNICAT === 'true',
    });
    return await requestHandler.handleRequest();
  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
}
