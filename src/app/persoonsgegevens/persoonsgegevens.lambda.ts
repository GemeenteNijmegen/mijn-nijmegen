import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { AWS, environmentVariables } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { PersoonsgegevensRequestHandler } from './persoonsgegevensRequestHandler';
import { ApiClient as ApiClientV2 } from '../../shared/ApiClient';
import { HaalCentraalApi } from '../../shared/HaalCentraalApi';
import { OpenKlantApi } from '../../shared/OpenKlantApi';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });

let haalCentraalApi: HaalCentraalApi | undefined = undefined;
let openKlantApi: OpenKlantApi | undefined = undefined;

async function init() {
  console.time('init');
  console.timeLog('init', 'start init HaalCentraal API Client');
  // Construct the haal centraal API client
  const haalCentraalValues = environmentVariables([
    'HAAL_CENTRAAL_CERT_SSM',
    'HAAL_CENTRAAL_PRIVATE_KEY_ARN',
    'HAAL_CENTRAAL_API_KEY_ARN',
    'HAAL_CENTRAAL_BASE_URL',
  ]);
  const haalCentraalApiClient = new ApiClientV2({
    apikey: {
      header: 'X-API-KEY',
      keyArn: haalCentraalValues.HAAL_CENTRAAL_API_KEY_ARN,
    },
    mtls: {
      cert: haalCentraalValues.HAAL_CENTRAAL_CERT_SSM,
      keyArn: haalCentraalValues.HAAL_CENTRAAL_PRIVATE_KEY_ARN,
    },
  });
  haalCentraalApi = new HaalCentraalApi({
    apiclient: haalCentraalApiClient,
    baseUrl: haalCentraalValues.HAAL_CENTRAAL_BASE_URL,
  });

  // Setup OpenKlant API client if feature flag is enabled
  if (process.env.CONTACTGEGEVENS_LIVE === 'True') {
    const openKlantValues = environmentVariables([
      'OPENKLANT_API_KEY_ARN',
      'OPENKLANT_API_ENDPOINT',
    ]);
    const openKlantApiClient = new ApiClientV2({
      apikey: {
        header: 'Authorization',
        keyArn: openKlantValues.OPENKLANT_API_KEY_ARN,
      },
    });
    const openKlantEndpoint = await AWS.getParameter(openKlantValues.OPENKLANT_API_ENDPOINT);
    openKlantApi = new OpenKlantApi({
      apiclient: openKlantApiClient,
      baseUrl: openKlantEndpoint,
    });
  }

  console.timeLog('init', 'end init HaalCentraal API Client');
  console.timeEnd('init');
}

const initialization = init();


function parseEvent(event: APIGatewayProxyEventV2): any {
  let body: any = {};
  if (event.body) {
    let decodedBody = event.body;
    if (event.isBase64Encoded) {
      decodedBody = Buffer.from(event.body, 'base64').toString('utf-8');
    }
    try {
      const params = new URLSearchParams(decodedBody);
      body = Object.fromEntries(params.entries());
    } catch (e) {
      body = {};
    }
  }
  return {
    cookies: event?.cookies?.join(';'),
    method: event.requestContext.http.method,
    body,
    path: event.rawPath,
  };
}

export async function handler(event: any, _context: any): Promise<ApiGatewayV2Response> {
  await initialization;

  try {
    const params = parseEvent(event);

    if (!haalCentraalApi) {
      throw new Error('Failed to initalize haal centraal api');
    }

    const requestHandler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
      openKlantApi,
      contactgegevensLive: process.env.CONTACTGEGEVENS_LIVE == 'True',
    });

    return await requestHandler.handleRequest(params.cookies, params.method, params.body, params.path);

  } catch (err) {
    console.debug(err);
    return Response.error(500);
  }
};
