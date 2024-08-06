import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { handleLogoutRequest } from './handleLogoutRequest';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });

function parseEvent(event: any) {
  return {
    cookies: event?.cookies?.join(';'),
  };
}

exports.handler = async (event: any, _context: any) => {
  try {
    const params = parseEvent(event);
    return await handleLogoutRequest(params.cookies, dynamoDBClient);
  } catch (err) {
    console.error(err);
    Response.error(500);
  }
};