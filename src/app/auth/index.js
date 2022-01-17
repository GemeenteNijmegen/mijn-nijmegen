const { Session } = require('./shared/Session');
const { OpenIDConnect } = require('./shared/OpenIDConnect');


exports.handler = async (event, context) => {
    try {
        let response = {};
        let session = new Session(event);
        await session.init();
        
        if(session.sessionId === false) {
            response = {
                'statusCode': 302,
                'body': '',
                'headers': { 
                    'Location': '/login'
                }
            }
            return response;
        }
        const state = session.state;
        console.debug(session.state);
        const OIDC = new OpenIDConnect();
        const claims = await OIDC.authorize(event?.queryStringParameters?.code, state);
        if(claims) {
            session.updateSession(true, claims.sub);
        } else {
            response = {
                'statusCode': 302,
                'body': '',
                'headers': { 
                    'Location': '/login'
                }
            }
            return response;
        }
        
        response = {
            'statusCode': 302,
            'body': '',
            'headers': { 
                'Location': '/'
            }
        }
        return response;
    } catch (err) {
        console.debug(err);
        response = {
            'statusCode': 500
        }
        return response;
    }
};