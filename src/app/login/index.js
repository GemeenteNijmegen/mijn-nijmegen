const { Session } = require('./shared/Session');
const { OpenIDConnect } = require('./shared/OpenIDConnect');
const { render } = require('./shared/render');

function redirectToHome() {
    const response = {
        'statusCode': 302
    };
    return response;
}
exports.handler = async (event, context) => {
    try {
        let session = new Session(event);
        await session.init();
        if(session.isLoggedIn() === true) {
            return redirectToHome();
        } 
        await session.createSession();
        let OIDC = new OpenIDConnect();
        const authUrl = OIDC.getLoginUrl(session.state);
        const html = await render({authUrl: authUrl}, __dirname + '/templates/login.mustache');
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
    
    } catch (err) {
        console.debug(err);
        response = {
            'statusCode': 500
        }
        return response;
    }
};