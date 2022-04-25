const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Issuer, generators } = require('openid-client');

class OpenIDConnect {
    issuer = false;
    clientSecret = false;
    
    /**
     * Helper class for our OIDC auth flow
     */
    constructor() {
        this.issuer = this.getIssuer();
    }

    /**
     * Retrieve client secret from secrets manager
     * 
     * @returns string the client secret
     */
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

    /**
     * setup the oidc issuer. For now using env. parameters & hardcoded urls
     * Issuer could also be discovered based on file in .well-known, this
     * should be cached somehow.
     * 
     * @returns openid-client Issuer
     */
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

    /**
     * Get the login url for the OIDC-provider.
     * @param {string} state A string parameter that gets returned in the auth callback.
     * This should be checked before accepting the login response.
     * @returns {string} the login url
     */
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

    /**
     * Use the returned code from the OIDC-provider and stored state param 
     * to complete the login flow.
     * 
     * @param {string} code 
     * @param {string} state 
     * @returns {object | false} returns a claims object on succesful auth
     */
    async authorize(code, state, returnedState) {
        const base_url = new URL(process.env.APPLICATION_URL_BASE);
        const redirect_uri = new URL('/auth', base_url);
        const client_secret = await this.getOidcClientSecret();
        const client = new this.issuer.Client({
            client_id: process.env.OIDC_CLIENT_ID,
            redirect_uris: [redirect_uri],
            client_secret: client_secret,
            response_types: ['code'],
        });
        const params = client.callbackParams(redirect_uri + '/?code=' + code + '&state=' + returnedState);
        if(state !== returnedState) {
            throw new Error('state does not match session state');
        }
        let tokenSet;
        try {
            tokenSet = await client.callback(redirect_uri, params, { state: state });
        } catch(err) {
            throw new Error(`${err.error} ${err.error_description}`);
        }
        const claims = tokenSet.claims();
        if(claims.aud != process.env.OIDC_CLIENT_ID) { 
            throw new Error('claims aud does not match client id');
        }
        return claims;
       
    }
    
    generateState() {
        return generators.state();
    }
}
exports.OpenIDConnect = OpenIDConnect;