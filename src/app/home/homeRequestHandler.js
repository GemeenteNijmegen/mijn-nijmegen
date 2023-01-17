const { render } = require('./shared/render');
const { Session } = require('@gemeentenijmegen/session');
const { Response } = require('@gemeentenijmegen/apigateway-http/lib/V2/Response');

exports.homeRequestHandler = async (cookies, apiClient, dynamoDBClient) => {
    let session = new Session(cookies, dynamoDBClient);
    await session.init();
    if (session.isLoggedIn() == true) {
        return await handleLoggedinRequest(session, apiClient);
    }
    return Response.redirect('/login');
}

async function handleLoggedinRequest(session) {
    const naam = session.getValue('username') ?? 'Onbekende gebruiker';
    data = {
        title: 'overzicht',
        shownav: true,
        volledigenaam: naam
    };

    // render page
    const html = await render(data, __dirname + '/templates/home.mustache', {
        'header': `${__dirname}/shared/header.mustache`,
        'footer': `${__dirname}/shared/footer.mustache`
    });
    
    return Response.html(html, 200, session.getCookie());
}

