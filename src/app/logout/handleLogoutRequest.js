const { render } = require('./shared/render');
const { Response } = require('@gemeentenijmegen/apigateway-http/lib/V2/Response');
const cookie = require('cookie');
const { Session } = require('@gemeentenijmegen/session');

async function handleLogoutRequest(cookies, dynamoDBClient) {
    let session = new Session(cookies, dynamoDBClient);
    if(await session.init()) {
        await session.updateSession({
            loggedin: { BOOL: false },
        });
    }

    const html = await render({title : 'Uitgelogd'}, __dirname + '/templates/logout.mustache', { 
        'header': `${__dirname}/shared/header.mustache`,
        'footer': `${__dirname}/shared/footer.mustache`
    });
    const emptyCookie = cookie.serialize('session', '', {
        httpOnly: true,
        secure: true
    });
    return Response.html(html, 200, [emptyCookie]);
}
exports.handleLogoutRequest = handleLogoutRequest;
