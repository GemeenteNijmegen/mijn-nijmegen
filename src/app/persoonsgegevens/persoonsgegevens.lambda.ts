import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { AWS, environmentVariables } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ApiClient as ApiClientV2 } from '../../shared/ApiClient';
import { HaalCentraalApi } from '../../shared/HaalCentraalApi';
import { NotifyNLApi } from '../../shared/NotifyNLApi';
import { OpenKlantApi } from '../../shared/OpenKlantApi';
import { PersoonsgegevensRequestHandler } from './persoonsgegevensRequestHandler';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });

let haalCentraalApi: HaalCentraalApi | undefined = undefined;
let openKlantApi: OpenKlantApi | undefined = undefined;
let notifyNLApi: NotifyNLApi | undefined = undefined;
let notifyEmailTemplateId: string | undefined = undefined;
let notifySmsTemplateId: string | undefined = undefined;

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
        prefix: 'Token',
        keyArn: openKlantValues.OPENKLANT_API_KEY_ARN,
      },
    });
    const openKlantEndpoint = await AWS.getParameter(openKlantValues.OPENKLANT_API_ENDPOINT);
    openKlantApi = new OpenKlantApi({
      apiclient: openKlantApiClient,
      baseUrl: openKlantEndpoint,
    });

    // Setup NotifyNL API client
    const notifyValues = environmentVariables([
      'NOTIFY_SECRET_ARN',
      'NOTIFY_SERVICE_ID',
      'NOTIFY_BASE_URL',
      'NOTIFY_EMAIL_TEMPLATE_ID',
      'NOTIFY_SMS_TEMPLATE_ID',
    ]);
    const notifySecret = await AWS.getSecret(notifyValues.NOTIFY_SECRET_ARN);
    const notifyServiceId = await AWS.getParameter(notifyValues.NOTIFY_SERVICE_ID);
    const notifyBaseUrl = await AWS.getParameter(notifyValues.NOTIFY_BASE_URL);
    notifyEmailTemplateId = await AWS.getParameter(notifyValues.NOTIFY_EMAIL_TEMPLATE_ID);
    notifySmsTemplateId = await AWS.getParameter(notifyValues.NOTIFY_SMS_TEMPLATE_ID);
    notifyNLApi = new NotifyNLApi({
      secret: notifySecret,
      issServiceId: notifyServiceId,
      baseUrl: notifyBaseUrl,
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
    queryStringParameters: event.queryStringParameters || {},
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
      notifyNLApi,
      notifyEmailTemplateId,
      notifySmsTemplateId,
      contactgegevensLive: process.env.CONTACTGEGEVENS_LIVE == 'True',
    });

    return await requestHandler.handleRequest(params);

  } catch (err) {
    console.debug(err);
    return Response.error(500);
  }
};
