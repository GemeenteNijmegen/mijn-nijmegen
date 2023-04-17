import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { Session } from '@gemeentenijmegen/session';
import { Bsn } from '@gemeentenijmegen/utils';
import { BrpApi } from './BrpApi';
import { OpenIDConnect } from '../../shared/OpenIDConnect';

interface requestProps {
  cookies: string;
  queryStringParamCode: string;
  queryStringParamState: string;
  dynamoDBClient: DynamoDBClient;
  apiClient: ApiClient;
  OpenIdConnect: OpenIDConnect;
}

export async function handleRequest(props: requestProps) {
  const logger = new Logger({ serviceName: 'mijnnijmegen' });
  let session = new Session(props.cookies, props.dynamoDBClient);
  await session.init();
  if (session.sessionId === false) {

    return Response.redirect('/login');
  }
  const state = session.getValue('state');
  try {
    const claims = await props.OpenIdConnect.authorize(props.queryStringParamCode, state, props.queryStringParamState);
    if (claims) {
      const bsn = new Bsn(claims.sub);
      if (claims.hasOwnProperty('acr')) {
        logger.info('auth succesful', { loa: claims.acr });
      }
      try {
        const username = await loggedinUserName(bsn.bsn, props.apiClient);
        await session.createSession({
          loggedin: { BOOL: true },
          bsn: { S: bsn.bsn },
          username: { S: username },
        });
      } catch (error: any) {
        console.error(error.message);
        return Response.error(500);
      }
    } else {
      return Response.redirect('/login');
    }
  } catch (error: any) {
    console.error(error.message);
    return Response.redirect('/login');
  }
  return Response.redirect('/', 302, [session.getCookie()]);
}


async function loggedinUserName(bsn: string, apiClient: ApiClient) {
  try {
    const brpApi = new BrpApi(apiClient);
    const brpData = await brpApi.getBrpData(bsn);
    const naam = brpData?.Persoon?.Persoonsgegevens?.Naam ? brpData.Persoon.Persoonsgegevens.Naam : 'Onbekende gebruiker';
    return naam;
  } catch (error) {
    console.error('Error getting username');
    return 'Onbekende gebruiker';
  }
}