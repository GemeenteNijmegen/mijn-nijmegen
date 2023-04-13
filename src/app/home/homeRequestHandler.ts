import { render } from '../../shared/render';
import { Session } from '@gemeentenijmegen/session';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

export async function homeRequestHandler(cookies: string, dynamoDBClient: DynamoDBClient) {
    let session = new Session(cookies, dynamoDBClient);
    await session.init();
    if (session.isLoggedIn() == true) {
        return await handleLoggedinRequest(session);
    }
    return Response.redirect('/login');
}

async function handleLoggedinRequest(session: Session) {
    const naam = session.getValue('username') ?? 'Onbekende gebruiker';
    const data = {
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

