const cookie = require('cookie');
const crypto = require('crypto');
const { Issuer, generators } = require('openid-client');
const { DynamoDBClient, GetItemCommand, PutItemCommand } = require("@aws-sdk/client-dynamodb");

const dbClient = new DynamoDBClient();

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
    const issuer = getOpenIDConnectIssuer(process.env.AUTH_URL_BASE);
    const base_url = new URL(process.env.APPLICATION_URL_BASE);
    const redirect_uri = new URL('/auth', base_url);
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

async function getSessionId(event) {
    if('cookies' in event) {
        const cookies = cookie.parse(event.cookies.join(';'));
        if('session' in cookies) { 
            return cookies.session;
        }
    }
    return false;
}

async function checkLoginOrCreateSession(event) {
    if('cookies' in event) {
        const cookies = cookie.parse(event.cookies.join(';'));
        if('session' in cookies) { 
            const session = await getSession(cookies.session);
            if(session) {
                return session.loggedin.BOOL;
            }
        }
    }
    await createSession();
    return false;
}

async function isLoggedIn(sessionId) {
    const getItemCommand = new GetItemCommand({
        TableName: process.env.SESSION_TABLE,
        Key: {
            'sessionid': { S: sessionId }
        }
    });
    try {
        const session = await dbClient.send(getItemCommand);
        if(session.Item) {
            return session.Item.loggedin.BOOL;
        }
    } catch(err) {
        console.log('Error getting session from DynamoDB: ' + err);
        throw err;
    }
    return false;
}

async function createSession() {
    const state = generators.state();
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const ttl = Math.floor((now / 1000) + 15 * 60).toString(); // ttl is 15 minutes
    
    const command = new PutItemCommand({
        TableName: process.env.SESSION_TABLE,
        Item: {
            'sessionid': { S: sessionId },
            'state': { S: state },
            'bsn': { S: '' },
            'created': { N: ttl },
            'loggedin': { BOOL: false }
        }
    });
    await dbClient.send(command);
    return { 'sessionId': sessionId, 'state': state };
}

function redirectToHome() {
    const response = {
        'statusCode': 302
    };
    return response;
}


exports.handler = async (event, context) => {
    try {
        let sessionId = await getSessionId(event);
        if(sessionId) {
            const loginActive = await isLoggedIn(sessionId);
            console.debug(loginActive);
            if(loginActive === true) {
                return redirectToHome();
            }
        }
        
        const session = await createSession();
        const authUrl = getLoginUrl(session.state);
        const html = `<html><head><title>Login</title></head><body><h1>Login</h1><a href="${authUrl}">Login</a></body></html>`;
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