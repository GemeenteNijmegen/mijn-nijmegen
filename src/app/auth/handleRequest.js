const { Session } = require('./shared/Session');
const { OpenIDConnect } = require('./shared/OpenIDConnect');

function redirectResponse(location, code = 302) {
    return {
        'statusCode': code,
        'body': '',
        'headers': {
            'Location': location
        }
    };
}

async function handleRequest(cookies, queryStringParamCode, dynamoDBClient) {
    let session = new Session(cookies, dynamoDBClient);
    await session.init();

    if (session.sessionId === false) {
        return redirectResponse('/login');
    }
    const state = session.state;
    const OIDC = new OpenIDConnect();
    const claims = await OIDC.authorize(queryStringParamCode, state);
    if (claims) {
        session.updateSession(true, claims.sub);
    } else {
        return redirectResponse('/login');
    }

    return redirectResponse('/');
}
exports.handleRequest = handleRequest;
