const { Session } = require('./shared/Session');
const { OpenIDConnect } = require('./shared/OpenIDConnect');

function redirectResponse(location, code = 302) {
    return {
        'statusCode': code,
        'body': '',
        'headers': { 
            'Location': location
        }
    }
}

async function handleRequest(cookies, queryStringParamCode) {
    let response = {};
    let session = new Session(cookies);
    await session.init();
    
    if(session.sessionId === false) {
        return redirectResponse('/login');
    }
    const state = session.state;
    const OIDC = new OpenIDConnect();
    const claims = await OIDC.authorize(queryStringParamCode, state);
    if(claims) {
        session.updateSession(true, claims.sub);
    } else {
        return redirectResponse('/login');
    }

    return redirectResponse('/');
}

function parseEvent(event) {
    return { 
        'cookies': event?.cookies?.join(';'),
        'code': event?.queryStringParameters?.code
    };
}

exports.handler = async (event, context) => {
    try {
        const params = parseEvent(event);
        return await handleRequest(params.cookies, params.code);
    } catch (err) {
        console.debug(err);
        response = {
            'statusCode': 500
        }
        return response;
    }
};