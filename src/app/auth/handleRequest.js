const { Session } = require('@gemeentenijmegen/session');
const { Response } = require('@gemeentenijmegen/apigateway-http/lib/V2/Response');
const { OpenIDConnect } = require('./shared/OpenIDConnect');

async function handleRequest(cookies, queryStringParamCode, queryStringParamState, dynamoDBClient) {
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
            await session.createSession({ 
                loggedin: { BOOL: true },
                bsn: { S: claims.sub }
            });
        } else {
            return Response.redirect('/login');
        }
    } catch (error) {
        console.error(error.message);
        return Response.redirect('/login');
    }
    return Response.redirect('/', 302, [session.getCookie()]);
}
exports.handleRequest = handleRequest;
