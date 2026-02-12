import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { PersoonsgegevensRequestHandler } from './persoonsgegevensRequestHandler';
import { ApiClient as ApiClientV2 } from '../../shared/ApiClient';
import { HaalCentraalApi } from '../../shared/HaalCentraalApi';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });


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
const haalCentraalApi = new HaalCentraalApi({
  apiclient: haalCentraalApiClient,
  baseUrl: haalCentraalValues.HAAL_CENTRAAL_BASE_URL,
});
console.timeLog('init', 'end init HaalCentraal API Client');
console.timeEnd('init');


function parseEvent(event: APIGatewayProxyEventV2): any {
  return {
    cookies: event?.cookies?.join(';'),
  };
}

export async function handler(event: any, _context: any): Promise<ApiGatewayV2Response> {
  try {
    const params = parseEvent(event);

    if (!haalCentraalApi) {
      throw new Error('Failed to initalize haal centraal api');
    }

    const requestHandler = new PersoonsgegevensRequestHandler({
      dynamoDBClient,
      haalCentraalApi,
    });

    return await requestHandler.handleRequest(params.cookies);

  } catch (err) {
    console.debug(err);
    return Response.error(500);
  }
};
