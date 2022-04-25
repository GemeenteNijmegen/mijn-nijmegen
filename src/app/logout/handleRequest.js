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

async function handleRequest(cookies, dynamoDBClient) {
    let session = new Session(cookies, dynamoDBClient);
    await session.init();

    if (session.sessionId !== false) {
        await session.updateSession(false);
    }

    const html = await render({title : 'Uitgelogd'}, __dirname + '/templates/logout.mustache', { 
        'header': `${__dirname}/shared/header.mustache`,
        'footer': `${__dirname}/shared/footer.mustache`
    });
    const newCookies = ['session=; HttpOnly; Secure;'];
    return htmlResponse(html, newCookies);
}
exports.handleRequest = handleRequest;
