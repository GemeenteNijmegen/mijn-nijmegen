import process from 'process';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { AWS, environmentVariables } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { AuthRequestHandler } from './AuthRequestHandler';
import { ApiClient as ApiClientV2 } from '../../shared/ApiClient';
import { HaalCentraalApi } from '../../shared/HaalCentraalApi';
import { OpenIDConnect } from '../../shared/OpenIDConnect';
import { OpenKlantApi } from '../../shared/OpenKlantApi';

// --- Dev-only import ---

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });

/**
 * True only when explicitly enabled AND not running in production.
 * Prevents accidental exposure if the env var leaks into a production deploy.
 */
const NO_AUTH_ENABLED =
  process.env.NO_AUTH === 'true' && process.env.NODE_ENV !== 'production';

let OIDC: OpenIDConnect | undefined = undefined;
let haalCentraalApi: HaalCentraalApi | undefined = undefined;
let openKlantApi: OpenKlantApi | undefined = undefined;

async function init() {
  // Skip external dependencies entirely in no-auth mode
  if (NO_AUTH_ENABLED) {
    console.warn('[DEV] NO_AUTH mode enabled — skipping OIDC and API initialization');
    return;
  }

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

  if (process.env.CONTACTGEGEVENS_LIVE === 'True') {
    const openKlantValues = environmentVariables([
      'OPENKLANT_API_KEY_ARN',
      'OPENKLANT_API_ENDPOINT',
    ]);
    const openKlantApiClient = new ApiClientV2({
      apikey: {
        header: 'Authorization',
        prefix: 'Token',
        keyArn: openKlantValues.OPENKLANT_API_KEY_ARN,
      },
    });
    const openKlantEndpoint = await AWS.getParameter(openKlantValues.OPENKLANT_API_ENDPOINT);
    openKlantApi = new OpenKlantApi({
      apiclient: openKlantApiClient,
      baseUrl: openKlantEndpoint,
    });
  }

  OIDC = new OpenIDConnect({
    clientId: process.env.OIDC_CLIENT_ID!,
    redirectUrl: process.env.OIDC_REDIRECT_URL!,
    wellknown: process.env.OIDC_WELL_KNOWN!,
    clientSecret: await AWS.getSecret(process.env.OIDC_CLIENT_SECRET_ARN!),
  });
}

const initaliation = init();

function parseEvent(event: APIGatewayProxyEventV2) {
  const url = `${process.env.OIDC_REDIRECT_URL}${event.rawPath}?${event.rawQueryString}`;
  return {
    fullUrl: new URL(url),
    cookies: event?.cookies?.join(';') ?? '',
    error: event?.queryStringParameters?.error,
    devBsn: (NO_AUTH_ENABLED) ? event?.queryStringParameters?.bsn : undefined,
  };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<ApiGatewayV2Response> {
  await initaliation;

  if (!OIDC || !haalCentraalApi) {
    throw Error('Failed to initalize properly');
  }

  try {
    const params = parseEvent(event);
    const requestHandler = new AuthRequestHandler({
      cookies: params.cookies,
      fullUrl: params.fullUrl,
      queryStringParamError: params.error,
      dynamoDBClient,
      OpenIdConnect: OIDC!,
      digidScope: process.env.DIGID_SCOPE ?? '',
      eherkenningScope: process.env.EHERKENNING_SCOPE ?? '',
      yiviScope: process.env.YIVI_SCOPE ?? '',
      yiviBsnAttribute: process.env.YIVI_BSN_ATTRIBUTE ?? '',
      yiviKvkNumberAttribute: process.env.YIVI_KVK_NUMBER_ATTRIBUTE ?? '',
      yiviKvkNameAttribute: process.env.YIVI_KVK_NAME_ATTRIBUTE ?? '',
      useYiviKvk: process.env.USE_YIVI_KVK === 'true',
      haalCentraalApi: haalCentraalApi,
      openKlantApi: openKlantApi,
      contactgegevensLive: process.env.CONTACTGEGEVENS_LIVE === 'True',
    });
    return await requestHandler.handleRequest();
  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
}
