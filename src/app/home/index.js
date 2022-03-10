const { Session } = require('./shared/Session');
const { render } = require('./shared/render');
const { UitkeringsApi } = require('./UitkeringsApi');
const { HTTPConnector } = require('./HTTPConnector');

function redirectResponse(location, code = 302) {
    return {
        'statusCode': code,
        'body': '',
        'headers': { 
            'Location': location
        }
    }
}

function parseEvent(event) {
    return { 
        'cookies': event?.cookies?.join(';'),
    };
}

async function requestHandler(cookies, Connector) {
    let session = new Session(cookies);
    await session.init();
    if(session.isLoggedIn() !== true) {
        return redirectResponse('/login');
    } 
    // Get API data
    const connector = Connector ? Connector : HTTPConnector;
    const api = new UitkeringsApi(session.getValue('bsn'), connector);
    const data = await api.getUitkeringen();
    
    // render page
    const html = await render(data, __dirname + '/templates/home.mustache');
    response = {
        'statusCode': 200,
        'body': html,
        'headers': { 
            'Content-type': 'text/html'
        },
        'cookies': [
            'session='+ session.sessionId + '; HttpOnly; Secure;',
        ]
    }
    return response;
}
exports.handler = async (event, context) => {
    try {
        const params = parseEvent(event);
        return await requestHandler(params.cookies);
    
    } catch (err) {
        console.debug(err);
        response = {
            'statusCode': 500
        }
        return response;
    }
};
exports.requestHandler = requestHandler;