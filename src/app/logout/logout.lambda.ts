import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { handleLogoutRequest } from './handleLogoutRequest';
import { cookiesFromEvent } from '../../shared/cookiesFromEvent';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });

function parseEvent(event: any) {
  return {
    cookies: cookiesFromEvent(event) ?? '',
  };
}

exports.handler = async (event: any) => {
  try {
    const params = parseEvent(event);
    return await handleLogoutRequest(params.cookies, dynamoDBClient);
  } catch (err) {
    console.error(err);
    Response.error(500);
  }
};