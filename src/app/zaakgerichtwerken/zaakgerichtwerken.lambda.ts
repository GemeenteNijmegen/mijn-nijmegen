import { Response } from '@gemeentenijmegen/apigateway-http';
import { APIGatewayEvent } from 'aws-lambda';
import { ZaakRequestHandler } from './ZaakRequestHandler';
import { UserFromAttributes } from '../zaken/User';

const zaakRequestHandler = new ZaakRequestHandler();

function parseEvent(event: APIGatewayEvent) {
  if (!event?.queryStringParameters?.userType || !event?.queryStringParameters?.userIdentifier) {
    throw Error('required params not set');
  }
  return {
    userType: event.queryStringParameters.userType,
    identifier: event.queryStringParameters.userIdentifier,
  };
}

export async function handler (event: APIGatewayEvent, _context: any):Promise<any> {
  try {
    console.debug(JSON.stringify(event));
    const params = parseEvent(event);
    const user = UserFromAttributes(params.userType, params.identifier);
    const result = zaakRequestHandler.list(user);
    return Response.json(result);
  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};
