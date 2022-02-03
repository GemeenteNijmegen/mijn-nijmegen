const { Session } = require('./shared/Session');
const { OpenIDConnect } = require('./shared/OpenIDConnect');
const { render } = require('./shared/render');

function redirectResponse(location, status = 302) {
    const response = {
        'statusCode': status,
        'headers': { 
            'Location': location
        }
    };
    return response;
}

function htmlResponse(body, cookies) {
    const response = {
        'statusCode': 200,
        'body': body,
        'headers': { 
            'Content-type': 'text/html'
        },
        'cookies': cookies
    };
    return response;
}

async function handleRequest(cookies) {
    let session = new Session(cookies);
    await session.init();
    if(session.isLoggedIn() === true) {
        return redirectResponse('/');
    }
    let OIDC = new OpenIDConnect();
    const state = OIDC.generateState();
    await session.createSession(state);
    const authUrl = OIDC.getLoginUrl(session.state);
    const html = await render({authUrl: authUrl}, __dirname + '/templates/login.mustache');
    const newCookies = ['session='+ session.sessionId + '; HttpOnly; Secure;'];
    return htmlResponse(html, newCookies);
}

function parseEvent(event) {
    return { 'cookies': event?.cookies?.join(';') };
}

exports.handler = async (event, context) => {
    try {
        const params = parseEvent(event);
        const response = await handleRequest(params.cookies);
        return response;
    } catch (err) {
        console.error(err);
        response = {
            'statusCode': 500
        }
        return response;
    }
};