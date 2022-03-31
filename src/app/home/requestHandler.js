const { Session } = require('./shared/Session');
const { render } = require('./shared/render');
const { BrpApi } = require('./BrpApi');

function redirectResponse(location, code = 302) {
    return {
        'statusCode': code,
        'body': '',
        'headers': { 
            'Location': location
        }
    }
}

exports.requestHandler = async (cookies, apiClient, dynamoDBClient) => {
    let session = new Session(cookies, dynamoDBClient);
    await session.init();
    if (session.isLoggedIn() !== true) {
        return redirectResponse('/login');
    }

    const bsn = session.getValue('bsn');
    const brpApi = new BrpApi(apiClient);
    const brpData = await brpApi.getBrpData(bsn);
    const naam = brpData?.Persoon?.Persoonsgegevens?.Naam ? brpData.Persoon.Persoonsgegevens.Naam : 'Onbekende gebruiker';
    data = { volledigenaam: naam };

    // render page
    const html = await render(data, __dirname + '/templates/home.mustache');
    response = {
        'statusCode': 200,
        'body': html,
        'headers': {
            'Content-type': 'text/html'
        },
        'cookies': [
            'session=' + session.sessionId + '; HttpOnly; Secure;',
        ]
    };
    return response;
}
