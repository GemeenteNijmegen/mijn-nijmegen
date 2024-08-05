import { Response } from '@gemeentenijmegen/apigateway-http';
import { APIGatewayEvent } from 'aws-lambda';

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
    console.log('user type: ', params.userType);
    return Response.ok();
  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};
