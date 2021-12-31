const cookie = require('cookie');
const { Issuer, generators } = require('openid-client');
const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");

function getOpenIDConnectIssuer(domain_url_part) {
    const issuer = new Issuer({
        issuer: `${domain_url_part}/broker/sp/oidc`,
        authorization_endpoint: `${domain_url_part}/broker/sp/oidc/authenticate`,
        token_endpoint: `${domain_url_part}/broker/sp/oidc/token`,
        jwks_uri: `${domain_url_part}/broker/sp/oidc/certs`,
        userinfo_endpoint: `${domain_url_part}/broker/sp/oidc/userinfo`,
        revocation_endpoint: `${domain_url_part}/broker/sp/oidc/token/revoke`,
        introspection_endpoint: `${domain_url_part}/broker/sp/oidc/token/introspect`,
        end_session_endpoint: `${domain_url_part}/broker/sp/oidc/logout`,
        token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
        introspection_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
        revocation_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
        revocation_endpoint_auth_methods_supported: "RS256"
    });
    return issuer;
}

function getLoginUrl(state) {
    const issuer = getOpenIDConnectIssuer(process.env.AUTH_DOMAIN);
    const redirect_uri = `${process.env.APPLICATION_URL_BASE}/auth`;
    const client = new issuer.Client({
        client_id: process.env.OIDC_CLIENT_ID,
        redirect_uris: [redirect_uri],
        response_types: ['code'],
    });
    const authUrl = client.authorizationUrl({
        scope: process.env.OIDC_SCOPE,  
        resource: process.env.AUTH_URL_BASE,
        state: state
    });
    return authUrl;
}

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
        return err;
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
        const state = generators.state();
        const authUrl = getLoginUrl(state);
        const html = `<html><head><title>Login</title></head><body><h1>Login</h1><a href="${authUrl}">Login</a></body></html>`;
        response = {
            'statusCode': 200,
            'body': html,
            'headers': { 
                'Content-type': 'text/html'
            }
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