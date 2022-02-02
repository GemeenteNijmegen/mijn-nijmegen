const { Session } = require('./shared/Session');
const { OpenIDConnect } = require('./shared/OpenIDConnect');

function redirectResponse(location, code = 200) {
    return {
        'statusCode': code,
        'body': '',
        'headers': { 
            'Location': location
        }
    }
}

exports.handler = async (event, context) => {
    try {
        let response = {};
        let session = new Session(event);
        await session.init();
        
        if(session.sessionId === false) {
            return redirectResponse('/login', 302);
        }
        const state = session.state;
        const OIDC = new OpenIDConnect();
        const claims = await OIDC.authorize(event?.queryStringParameters?.code, state);
        if(claims) {
            session.updateSession(true, claims.sub);
        } else {
            return redirectResponse('/login', 302);
        }

        return redirectResponse('/', 302);
    } catch (err) {
        console.debug(err);
        response = {
            'statusCode': 500
        }
        return response;
    }
};