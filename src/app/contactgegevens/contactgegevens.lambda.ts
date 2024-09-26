import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ContactgegevensRequestHandler } from './ContactgegevensRequestHandler';

const dynamoDBClient = new DynamoDBClient();

const requestHandler = new ContactgegevensRequestHandler({ dynamoDBClient, showZaken: process.env.SHOW_ZAKEN == 'True' });

function parseEvent(event: APIGatewayProxyEventV2) {
  return {
    cookies: event?.cookies?.join(';') ?? '',
  };
}

exports.handler = async (event: any, _context: any) => {
  try {
    const params = parseEvent(event);
    return await requestHandler.handleRequest(params.cookies);

  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};
