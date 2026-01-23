import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { AWS, environmentVariables } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ContactgegevensService } from './ContactgegevensService';
import { OpenklantApi } from './OpenKlantApi';
import { ContactgegevensRequestHandler, RequestParameters } from './RequestHandler';
import { NotifyNlVerificationService } from './VerificationService';

const dynamoDBClient = new DynamoDBClient();

const env = environmentVariables([
  'VERIFICATION_EMAIL_TEMPLATE_UUID',
  'VERIFICATION_SMS_TEMPLATE_UUID',
  'NOTIFY_ISSUER_UUID',
  'NOTIFY_SECRET',
  'NOTIFY_BASEURL',
]);

const logger = new Logger({ serviceName: 'Contactgegevens' });
const openKlantApi = new OpenklantApi(undefined, undefined, logger);
const contactgegevens = new ContactgegevensService(openKlantApi, logger);

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const params = parseEvent(event);
    const mijnContactgegevens = await setupHandler();
    return await mijnContactgegevens.handleRequest(params);
  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};

function parseEvent(event: APIGatewayProxyEventV2): RequestParameters {

  logger.debug('Raw event', { event });
  const formData = new URLSearchParams(decodeBody(event));

  return {
    cookies: event?.cookies?.join(';') ?? '',
    method: event?.requestContext.http.method,
    xsrf_token: formData?.get('xsrf_token') ?? undefined,
    email: formData?.get('email') ?? undefined,
    telefoonnummer: formData?.get('telefoonnummer') ?? undefined,
    voorkeur: formData?.get('voorkeur') ?? undefined,
    error: event?.queryStringParameters?.error?.split(','),
    path: event?.rawPath,
    verificationCode: formData?.get('verificationCode') ?? undefined,
    type: event?.queryStringParameters?.type ?? undefined,
  };
}

function decodeBody(event: APIGatewayProxyEventV2) {
  if (!event.body) {
    return undefined;
  }
  if (!event.isBase64Encoded) {
    return event.body;
  }
  return Buffer.from(event.body, 'base64').toString('utf-8');
}


let requestHandler: ContactgegevensRequestHandler | undefined = undefined;

async function setupHandler() {
  if (!requestHandler) {
    const secrets = await getSecrets();
    const verificationService = new NotifyNlVerificationService({
      baseUrl: env.NOTIFY_BASEURL,
      emailTemplate: env.VERIFICATION_EMAIL_TEMPLATE_UUID,
      smsTemplate: env.VERIFICATION_SMS_TEMPLATE_UUID,
      notifyIssuer: secrets.NOTIFY_ISSUER_UUID,
      notifySecret: secrets.NOTIFY_SECRET,
    });
    requestHandler = new ContactgegevensRequestHandler({
      dynamoDBClient,
      contactgegevens,
      verification: verificationService,
    }, logger);
  }
  return requestHandler;
}

async function getSecrets() {
  return {
    NOTIFY_ISSUER_UUID: await AWS.getSecret(env.NOTIFY_ISSUER_UUID),
    NOTIFY_SECRET: await AWS.getSecret(env.NOTIFY_SECRET),
  };
}