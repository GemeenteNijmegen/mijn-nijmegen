import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { AWS, environmentVariables } from '@gemeentenijmegen/utils';
import { AuthenticationService } from './AuthenticationService';
import { AuthRequestHandler } from './AuthRequestHandler';
import { ApiClient as ApiClientV2 } from '../../shared/ApiClient';
import { HaalCentraalApi } from '../../shared/HaalCentraalApi';
import { OpenIDConnect } from '../../shared/OpenIDConnect';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const apiClient = new ApiClient();
const OIDC = new OpenIDConnect();

let authenticationService: AuthenticationService | undefined = undefined; // This is proof of cocept the API is actually secured with an classical API key
let haalCentraalApi: HaalCentraalApi | undefined = undefined;
async function init() {
  if (process.env.USE_AUTH_SERVICE === 'true') {
    const clientSecret = await AWS.getSecret(process.env.AUTH_SERVICE_CLIENT_SECRET_ARN!);
    authenticationService = new AuthenticationService(process.env.AUTH_SERVICE_ENDPOINT!, process.env.AUTH_SERVICE_CLIENT_ID!, clientSecret);
  }

  // Construct the haal centraal API client
  if (process.env.HAAL_CENTRAAL_LIVE === 'true') {
    const haalCentraalValues = environmentVariables([
      'HAAL_CENTRAAL_CERT_SSM',
      'HAAL_CENTRAAL_PRIVATE_KEY_ARN',
      'HAAL_CENTRAAL_API_KEY_ARN',
      'HAAL_CENTRAAL_BASE_URL',
    ]);
    const haalCentraalApiClient = new ApiClientV2({
      mtls: {
        cert: haalCentraalValues.HAAL_CENTRAAL_CERT_SSM,
        keyArn: haalCentraalValues.HAAL_CENTRAAL_PRIVATE_KEY_ARN,
      },
      apikey: {
        header: 'X-API-KEY',
        keyArn: haalCentraalValues.HAAL_CENTRAAL_API_KEY_ARN,
      },
    });
    haalCentraalApi = new HaalCentraalApi({
      apiclient: haalCentraalApiClient,
      baseUrl: haalCentraalValues.HAAL_CENTRAAL_BASE_URL,
    });
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

export async function handler(event: any, _context: any): Promise<ApiGatewayV2Response> {
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
      haalCentraalApi: haalCentraalApi,
    });
    return await requestHandler.handleRequest();
  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
}
