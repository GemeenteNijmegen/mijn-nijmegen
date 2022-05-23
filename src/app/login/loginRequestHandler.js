const { Session } = require('@gemeentenijmegen/session');
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

async function handleLoginRequest(cookies, dynamoDBClient) {
    let session = new Session(cookies, dynamoDBClient);
    await session.init();
    if (session.isLoggedIn() === true) {
        console.debug('redirect to home');
        return redirectResponse('/');
    }
    let OIDC = new OpenIDConnect();
    const state = OIDC.generateState();
    await session.createSession({ 
        loggedin: { BOOL: false },
        state: { S: state }
    });
    const authUrl = OIDC.getLoginUrl(state);
    
    const data = {
        title: 'Inloggen',
        authUrl: authUrl
    }
    const html = await render(data, __dirname + '/templates/login.mustache', { 
        'header': `${__dirname}/shared/header.mustache`,
        'footer': `${__dirname}/shared/footer.mustache`
    });
    const newCookies = [session.getCookie()];
    return htmlResponse(html, newCookies);
}
exports.handleLoginRequest = handleLoginRequest;
