import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ContactgegevensService } from './ContactgegevensService';
import { OpenklantApi } from './OpenKlantApi';
import { ContactgegevensRequestHandler, RequestParameters } from './RequestHandler';
import { NotifyNlVerificationService } from './VerificationService';

const dynamoDBClient = new DynamoDBClient();

const logger = new Logger({ serviceName: 'Contactgegevens' });
const openKlantApi = new OpenklantApi(undefined, undefined, logger);
const contactgegevens = new ContactgegevensService(openKlantApi, logger);
const verificationService = new NotifyNlVerificationService('apikey', 'baseurl', 'emailTemplate', 'smsTemplate');

const requestHandler = new ContactgegevensRequestHandler({
  dynamoDBClient,
  contactgegevens,
  verification: verificationService,
}, logger);


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
  };
}

exports.handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const params = parseEvent(event);
    return await requestHandler.handleRequest(params);

  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};

function decodeBody(event: APIGatewayProxyEventV2) {
  if (!event.body) {
    return undefined;
  }
  if (!event.isBase64Encoded) {
    return event.body;
  }
  return Buffer.from(event.body, 'base64').toString('utf-8');
}