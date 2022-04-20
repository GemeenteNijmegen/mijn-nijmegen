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

async function handleRequest(cookies, queryStringParamCode, queryStringParamState, dynamoDBClient) {
    let session = new Session(cookies, dynamoDBClient);
    await session.init();

    if (session.sessionId === false) {
        return redirectResponse('/login');
    }
    const state = session.state;
    const OIDC = new OpenIDConnect();
    try {
        const claims = await OIDC.authorize(queryStringParamCode, state, queryStringParamState, queryStringParamState);    
        if (claims) {
            session.updateSession(true, claims.sub);
        } else {
            return redirectResponse('/login');
        }
    } catch (error) {
        console.error(error.message);
        return redirectResponse('/');
    }
    return redirectResponse('/');
}
exports.handleRequest = handleRequest;
