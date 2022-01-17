const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Issuer } = require('openid-client');

class OpenIDConnect {
    issuer = false;
    clientSecret = false;
    constructor() {
        this.issuer = this.getIssuer();
    }

    async getOidcClientSecret() {
        if(!this.clientSecret) { 
            const secretsManagerClient = new SecretsManagerClient();
            const command = new GetSecretValueCommand({ SecretId: process.env.CLIENT_SECRET_ARN });
            const data = await secretsManagerClient.send(command);
            // Depending on whether the secret is a string or binary, one of these fields will be populated.
            if ('SecretString' in data) {
                this.clientSecret = data.SecretString
            } else {      
                console.log('no secret value found');
            }
        }
        return this.clientSecret;
    }

    getIssuer() {
        const issuer = new Issuer({
            issuer: `${process.env.AUTH_URL_BASE}/broker/sp/oidc`,
            authorization_endpoint: `${process.env.AUTH_URL_BASE}/broker/sp/oidc/authenticate`,
            token_endpoint: `${process.env.AUTH_URL_BASE}/broker/sp/oidc/token`,
            jwks_uri: `${process.env.AUTH_URL_BASE}/broker/sp/oidc/certs`,
            userinfo_endpoint: `${process.env.AUTH_URL_BASE}/broker/sp/oidc/userinfo`,
            revocation_endpoint: `${process.env.AUTH_URL_BASE}/broker/sp/oidc/token/revoke`,
            introspection_endpoint: `${process.env.AUTH_URL_BASE}/broker/sp/oidc/token/introspect`,
            end_session_endpoint: `${process.env.AUTH_URL_BASE}/broker/sp/oidc/logout`,
            token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
            introspection_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
            revocation_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
            revocation_endpoint_auth_methods_supported: "RS256"
        });
        return issuer;
    }

    getLoginUrl(state) {
        const base_url = new URL(process.env.APPLICATION_URL_BASE);
        const redirect_uri = new URL('/auth', base_url);
        const client = new this.issuer.Client({
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

    async authorize(code, state) {
        const base_url = new URL(process.env.APPLICATION_URL_BASE);
        const redirect_uri = new URL('/auth', base_url);
        const client_secret = await this.getOidcClientSecret();
        const client = new this.issuer.Client({
            client_id: process.env.OIDC_CLIENT_ID,
            redirect_uris: [redirect_uri],
            client_secret: client_secret,
            response_types: ['code'],
        });
        const params = client.callbackParams(redirect_uri + '/?code=' + code + '&state=' + state);
        const tokenSet = await client.callback(redirect_uri, params, { state: state }); // => Promise
        const claims = tokenSet.claims();
        if(claims.aud != process.env.OIDC_CLIENT_ID) { 
            return false;
        }
        console.log(JSON.stringify(claims));
        const bsn = claims.sub;
        return claims;
    }
}
exports.OpenIDConnect = OpenIDConnect;