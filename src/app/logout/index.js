const { Session } = require('./shared/Session');
const { render } = require('./shared/render');

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

async function handleRequest(cookies, queryStringParamCode) {
    let session = new Session(cookies);
    await session.init();
    
    if(session.sessionId !== false) {
        await session.updateSession(false);
    }
    const html = await render({}, __dirname + '/templates/logout.mustache');
    const newCookies = ['session=; HttpOnly; Secure;'];
    return htmlResponse(html, newCookies);
}

function parseEvent(event) {
    return { 
        'cookies': event?.cookies?.join(';')
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