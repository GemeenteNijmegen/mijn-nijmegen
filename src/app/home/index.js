const { Session } = require('./shared/Session');
const { render } = require('./shared/render');
const { UitkeringsApi } = require('./UitkeringsApi');
const { BrpApi } = require('./BrpApi');
const { ApiClient } = require('./ApiClient');

function redirectResponse(location, code = 302) {
    return {
        'statusCode': code,
        'body': '',
        'headers': { 
            'Location': location
        }
    }
}

function parseEvent(event) {
    return { 
        'cookies': event?.cookies?.join(';'),
    };
}

async function requestHandler(cookies, client) {
    let session = new Session(cookies);
    await session.init();
    if(session.isLoggedIn() !== true) {
        return redirectResponse('/login');
    } 
    // Get API data
    client = client ? client : new ApiClient();
    const uitkeringsApi = new UitkeringsApi(client);
    const data = await uitkeringsApi.getUitkeringen(session.getValue('bsn'));
    
    const brpApi = new BrpApi(client);
    const brpData = await brpApi.getBrpData(session.getValue('bsn'));
result.Persoon
    data.volledigenaam = brpData?.Persoon?.Persoonsgegevens?.Naam ? brpData.Persoon.Persoonsgegevens.Naam : 'Onbekende gebruiker';
    
    // render page
    const html = await render(data, __dirname + '/templates/home.mustache');
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
}
exports.handler = async (event, context) => {
    try {
        const params = parseEvent(event);
        return await requestHandler(params.cookies);
    
    } catch (err) {
        console.debug(err);
        response = {
            'statusCode': 500
        }
        return response;
    }
};
exports.requestHandler = requestHandler;