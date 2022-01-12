const { Issuer } = require('openid-client');
const { Session } = require('./shared/Session');

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

function redirectToHome() {
    const response = {
        'statusCode': 302
    };
    return response;
}
exports.handler = async (event, context) => {
    try {
        let session = new Session(event);
        await session.init();
        if(session.isLoggedIn() === true) {
            return redirectToHome();
        } 
        await session.createOrUpdateSession();
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