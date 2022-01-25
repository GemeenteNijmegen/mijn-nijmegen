const { Session } = require('./shared/Session');
const { render } = require('./shared/render');

function redirectToLogin() {
    const response = {
        'statusCode': 302,
        'headers': { 
            'Location': '/login'
        }
    };
    return response;
}
exports.handler = async (event, context) => {
    try {
        let session = new Session(event);
        await session.init();
        if(session.isLoggedIn() !== true) {
            return redirectToLogin();
        } 
        // Get API data
        // render page
        const html = await render({}, __dirname + '/templates/home.mustache');
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