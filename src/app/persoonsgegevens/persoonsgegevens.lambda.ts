import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { AWS, environmentVariables } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { PersoonsgegevensRequestHandler } from './persoonsgegevensRequestHandler';
import { HaalCentraalApi } from '../../shared/HaalCentraalApi';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const apiClient = new ApiClient();

let haalCentraalApi: HaalCentraalApi | undefined = undefined;

async function init() {
  console.time('init');
  console.timeLog('init', 'start init old BRP API client');
  let promise = apiClient.init();
  console.timeLog('init', 'end init old BRP API client');

  console.timeLog('init', 'start init HaalCentraal API Client');
  // Construct the haal centraal API client
  if (process.env.HAAL_CENTRAAL_LIVE === 'true') {
    const haalCentraalValues = environmentVariables([
      'HAAL_CENTRAAL_CERT_SSM',
      'HAAL_CENTRAAL_CA_SSM',
      'HAAL_CENTRAAL_PRIVATE_KEY_ARN',
      'HAAL_CENTRAAL_API_KEY_ARN',
      'HAAL_CENTRAAL_BASE_URL',
    ]);
    const haalCentraalApiClient = await ApiClient.fromParameterStore(
      haalCentraalValues.HAAL_CENTRAAL_CERT_SSM,
      haalCentraalValues.HAAL_CENTRAAL_CA_SSM,
      haalCentraalValues.HAAL_CENTRAAL_PRIVATE_KEY_ARN,
    );
    haalCentraalApi = new HaalCentraalApi({
      apiclient: haalCentraalApiClient,
      apiKey: await AWS.getSecret(haalCentraalValues.HAAL_CENTRAAL_API_KEY_ARN),
      baseUrl: haalCentraalValues.HAAL_CENTRAAL_BASE_URL,
    });
  }
  console.timeLog('init', 'end init HaalCentraal API Client');
  console.timeEnd('init');
  return promise;
}

const initPromise = init();

function parseEvent(event: APIGatewayProxyEventV2): any {
  return {
    cookies: event?.cookies?.join(';'),
  };
}

export async function handler(event: any, _context: any): Promise<ApiGatewayV2Response> {
  try {
    const params = parseEvent(event);
    await initPromise;

    const requestHandler = new PersoonsgegevensRequestHandler({
      apiClient,
      dynamoDBClient,
      haalCentraalApi,
      showZaken: process.env.SHOW_ZAKEN == 'True',
    });

    return await requestHandler.handleRequest(params.cookies);

  } catch (err) {
    console.debug(err);
    return Response.error(500);
  }
};
