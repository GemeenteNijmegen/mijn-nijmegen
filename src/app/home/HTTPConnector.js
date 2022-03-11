const https = require('https');
const axios = require('axios');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm"); // ES Modules import

class HTTPConnector {
    /**
     * Connects to the uitkeringsdata-API. Use .requestData() to get the actual info (as an XML string)
     * 
     * @param {string} bsn BSN to request uitkeringsdata for
     * @param {string|null} cert optional client cert, default is env variable MTLS_CLIENT_CERT
     * @param {string|null} key optional private key for client cert, default will get key from secret store
     * @param {string|null} ca optional root ca bundle to trust, default is env variable MTLS_ROOT_CA
     */
    constructor(bsn, cert, key, ca) {
        this.bsn = bsn;
        this.endpoint = process.env.UITKERING_API_URL;
        this.privatekey = key ? key : false;
        this.cert = cert ? cert : false;
        this.ca = ca ? ca : false;
    }

    /**
     * Retrieve certificate private key from secrets manager
     * 
     * @returns string private key
     */
     async getPrivateKey() {
        if(!this.privatekey) { 
            const secretsManagerClient = new SecretsManagerClient();
            const command = new GetSecretValueCommand({ SecretId: process.env.MTLS_PRIVATE_KEY_ARN });
            const data = await secretsManagerClient.send(command);
            // Depending on whether the secret is a string or binary, one of these fields will be populated.
            if ('SecretString' in data) {
                this.privatekey = data.SecretString
            } else {      
                console.log('no secret value found');
            }
        }
        return this.privatekey;
    }

    /**
     * Get a parameter from parameter store. This is used
     * as a workaround for the 4kb limit for environment variables.
     * 
     * @param {string} name Name of the ssm param
     * @returns param value
     */
    async getParameterValue(name) {
        const client = new SSMClient;
        const command = new GetParameterCommand({ Name: name });
        const response = await client.send(command);
        return response?.Parameter.Value;
    }

    /**
     * Request data from the API. 
     * @returns {string} XML string with uitkeringsdata
     */
    async requestData() {
        const key = await this.getPrivateKey();
        const cert = this.cert ? this.cert : await this.getParameterValue(process.env.MTLS_CLIENT_CERT_NAME);
        const ca = this.ca ? this.ca : await this.getParameterValue(process.env.MTLS_ROOT_CA_NAME);
        const httpsAgent = new https.Agent({ cert, key, ca });
        const body = this.body(this.bsn);
        const result = await axios.post(this.endpoint, body, { 
            httpsAgent: httpsAgent,
            headers: {
                'Content-type': 'text/xml',
                'SoapAction': this.endpoint + '/getData'
            }
        }).catch(err => console.log(err));
        return result.data;
    }

    body(bsn) {
        return `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
                <ns2:dataRequest xmlns:ns2="${this.endpoint}/">
                    <identifier>${bsn}</identifier>
                    <contentSource>mijnUitkering</contentSource>
                </ns2:dataRequest>
            </soap:Body>
        </soap:Envelope>`;
    }
}
exports.HTTPConnector = HTTPConnector;