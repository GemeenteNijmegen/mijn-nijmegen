import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ContactgegevensRequestHandler } from './ContactgegevensRequestHandler';
import { OpenklantApi } from './OpenKlantApi';

const dynamoDBClient = new DynamoDBClient();
const openKlantApi = new OpenklantApi();

const requestHandler = new ContactgegevensRequestHandler({ dynamoDBClient, openKlantApi });

function parseEvent(event: APIGatewayProxyEventV2) {

  const formData = new URLSearchParams(decodeBody(event));

  return {
    cookies: event?.cookies?.join(';') ?? '',
    method: event?.requestContext.http.method,
    xsrf_token: formData?.get('xsrf_token') ?? undefined,
    email: formData?.get('email') ?? undefined,
    telefoonnummer: formData?.get('telefoonnummer') ?? undefined,
    error: event?.queryStringParameters?.error?.split(','),
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