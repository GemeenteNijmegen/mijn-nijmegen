import { Session } from '@gemeentenijmegen/session';
import { Bsn } from '@gemeentenijmegen/utils';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { OpenIDConnect } from '../../shared/OpenIDConnect';
import { BrpApi } from './BrpApi';
import { Logger } from '@aws-lambda-powertools/logger';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

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
        console.debug('redirect 1')
        return Response.redirect('/login');
    }
    const state = session.getValue('state');
    try {
        const claims = await props.OpenIdConnect.authorize(props.queryStringParamCode, state, props.queryStringParamState);
        console.debug(claims);
        if (claims) {
            const bsn = new Bsn(claims.sub);
            if(claims.hasOwnProperty('acr')) {
                logger.info('auth succesful', { 'loa': claims.acr });
            }
            try {
                const username = await loggedinUserName(bsn.bsn, props.apiClient);
                await session.createSession({ 
                    loggedin: { BOOL: true },
                    bsn: { S: bsn.bsn },
                    username: { S: username },
                });
            }
            catch (error) {
                console.debug(error);
                return Response.error(500);
            }
        } else {
            return Response.redirect('/login');
        }
    } catch (error: any) {
        console.error(error.message);
        console.debug('redirect 2', error);
        return Response.redirect('/login');
    }
    console.debug('redirect 3')
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