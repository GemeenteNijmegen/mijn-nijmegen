const cookie = require('cookie');
const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");

async function checkLogin(event) {
    if('cookies' in event == false) {
        return false;
    }
    const cookies = cookie.parse(event.cookies.join(';'));
    if('session' in cookies == false) { 
        return false; 
    }
    const session = await getSession(cookies.session);
    if(session) {
        return session.loggedin.BOOL;
    }
    return false;
}

async function getSession(sessionId) {
    const dbClient = new DynamoDBClient();
    const getItemCommand = new GetItemCommand({
        TableName: process.env.SESSION_TABLE,
        Key: {
            'sessionid': { S: sessionId }
        }
    });
    try {
        const session = await dbClient.send(getItemCommand);
        if(session.Item) {
            return session.Item;
        }
    } catch(err) {
        console.log('Error getting session from DynamoDB: ' + err);
        return false;
    }
    return false;
}

function redirectToHome() {
    const response = {
        'statusCode': 302
    };
    return response;
}

exports.handler = async (event, context) => {
    try {
        const isLoggedIn = await checkLogin(event);
        if(isLoggedIn) {
            return redirectToHome();
        }
        const html = '<html><head><title>Login</title></head><body><h1>Login</h1></body></html>';
        response = {
            'statusCode': 200,
            'body': html,
            'headers': { 
                'Content-type': 'text/html'
            }
        }
        return response;
    } catch (err) {
        console.log(err);
        return err;
    }
};