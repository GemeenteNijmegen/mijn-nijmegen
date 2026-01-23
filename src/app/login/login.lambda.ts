import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { AWS } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { LoginRequestHandler, RequestParams } from './loginRequestHandler';
import { OpenIDConnectV2 } from '../../shared/OpenIDConnectV2';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });

let OIDC: OpenIDConnectV2 | undefined = undefined;
async function initialize() {
  // Setup ODIC client
  OIDC = new OpenIDConnectV2({
    clientId: process.env.OIDC_CLIENT_ID!,
    redirectUrl: process.env.OIDC_REDIRECT_URL!,
    wellknown: process.env.OIDC_WELL_KNOWN!,
    clientSecretArn: await AWS.getSecret(process.env.OIDC_CLIENT_SECRET_ARN!),
  });

  if (!process.env.OIDC_SCOPE || !process.env.DIGID_SCOPE) {
    throw Error('No OIDC_SCOPE or DIGID_SCOPE env. param provided');
  }

}

const init = initialize();

function parseEvent(event: APIGatewayProxyEventV2): RequestParams {
  return {
    cookies: event?.cookies?.join(';'),
    method: event?.queryStringParameters?.method,
  };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<ApiGatewayV2Response> {
  await init;

  const loginRequestHandler = new LoginRequestHandler({
    oidcScope: process.env.OIDC_SCOPE ?? '',
    digidScope: process.env.DIGID_SCOPE ?? '',
    yiviScope: process.env.YIVI_SCOPE,
    yiviBsnAttribute: process.env.YIVI_BSN_ATTRIBUTE,
    yiviCondisconScope: process.env.YIVI_CONDISCON_SCOPE,
    eHerkenningScope: process.env.EHERKENNING_SCOPE ?? '',
    useYiviKvk: process.env.USE_YIVI_KVK == 'true',
    oidc: OIDC!,
  });

  try {
    const params = parseEvent(event);
    const response = await loginRequestHandler.handleRequest(params, dynamoDBClient);
    return response;
  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};
