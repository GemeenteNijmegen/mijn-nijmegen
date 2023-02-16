const { Session } = require('@gemeentenijmegen/session');
const { Bsn } = require('@gemeentenijmegen/utils');
const { Response } = require('@gemeentenijmegen/apigateway-http/lib/V2/Response');
const { OpenIDConnect } = require('./shared/OpenIDConnect');
const { BrpApi } = require('./BrpApi');
const { Logger } = require('@aws-lambda-powertools/logger');


async function handleRequest(cookies, queryStringParamCode, queryStringParamState, dynamoDBClient, apiClient) {
    const logger = new Logger({ serviceName: 'mijnnijmegen' });
    let session = new Session(cookies, dynamoDBClient);
    await session.init();
    if (session.sessionId === false) {
        return Response.redirect('/login');
    }
    const state = session.getValue('state');
    const OIDC = new OpenIDConnect();
    try {
        const claims = await OIDC.authorize(queryStringParamCode, state, queryStringParamState, queryStringParamState);
        if (claims) {
            const bsn = new Bsn(claims.sub);
            if(claims.hasOwnProperty('acr')) {
                logger.info('auth succesful', { 'loa': claims.acr });
            }
            try {
                const username = await loggedinUserName(bsn.bsn, apiClient);
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
    } catch (error) {
        console.error(error.message);
        return Response.redirect('/login');
    }
    return Response.redirect('/', 302, [session.getCookie()]);
}


async function loggedinUserName(bsn, apiClient) {
    try { 
        const brpApi = new BrpApi(apiClient);
        const brpData = await brpApi.getBrpData(bsn);
        console.debug(brpData);
        const naam = brpData?.Persoon?.Persoonsgegevens?.Naam ? brpData.Persoon.Persoonsgegevens.Naam : 'Onbekende gebruiker';
        return naam;
    } catch (error) {
        console.error('Error getting username');
        return 'Onbekende gebruiker';
    }
}

exports.handleRequest = handleRequest;
