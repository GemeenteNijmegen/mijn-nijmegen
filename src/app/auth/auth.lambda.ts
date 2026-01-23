import process from 'process';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { AWS, environmentVariables } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { AuthRequestHandler } from './AuthRequestHandler';
import { ApiClient as ApiClientV2 } from '../../shared/ApiClient';
import { HaalCentraalApi } from '../../shared/HaalCentraalApi';
import { OpenIDConnectV2 } from '../../shared/OpenIDConnectV2';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const apiClient = new ApiClient();

let OIDC: OpenIDConnectV2 | undefined = undefined;
let haalCentraalApi: HaalCentraalApi | undefined = undefined;
async function init() {
  // Construct the haal centraal API client
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

  // Setup ODIC client
  OIDC = new OpenIDConnectV2({
    clientId: process.env.OIDC_CLIENT_ID!, // TODO load env vars and setup client
    redirectUrl: process.env.OIDC_REDIRECT_URL!,
    wellknown: process.env.OIDC_WELL_KNOWN!,
    clientSecretArn: await AWS.getSecret(process.env.OIDC_CLIENT_SECRET_ARN!),
  });

}
const initaliation = init();

function parseEvent(event: APIGatewayProxyEventV2) {
  const url = `${process.env.OIDC_REDIRECT_URL}${event.rawPath}?${event.rawQueryString}`;
  return {
    fullUrl: new URL(url),
    cookies: event?.cookies?.join(';') ?? '',
    error: event?.queryStringParameters?.error,
  };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<ApiGatewayV2Response> {
  await initaliation;

  if (!OIDC) {
    throw Error('Failed to initalize properly');
  }

  try {
    const params = parseEvent(event);
    const requestHandler = new AuthRequestHandler({
      cookies: params.cookies,
      fullUrl: params.fullUrl,
      queryStringParamError: params.error,
      dynamoDBClient,
      apiClient,
      OpenIdConnect: OIDC!,
      digidScope: process.env.DIGID_SCOPE ?? '',
      eherkenningScope: process.env.EHERKENNING_SCOPE ?? '',
      yiviScope: process.env.YIVI_SCOPE ?? '',
      yiviBsnAttribute: process.env.YIVI_BSN_ATTRIBUTE ?? '',
      yiviKvkNumberAttribute: process.env.YIVI_KVK_NUMBER_ATTRIBUTE ?? '',
      yiviKvkNameAttribute: process.env.YIVI_KVK_NAME_ATTRIBUTE ?? '',
      useYiviKvk: process.env.USE_YIVI_KVK === 'true',
      haalCentraalApi: haalCentraalApi,
    });
    return await requestHandler.handleRequest();
  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
}
