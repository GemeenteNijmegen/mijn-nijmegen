const { ApiClient } = require('./ApiClient');

class HTTPConnector {
    /**
     * Connects to the uitkeringsdata-API. Use .requestData() to get the actual info (as an XML string)
     * 
     * @param {string} bsn BSN to request uitkeringsdata for
     * @param {string|null} cert optional client cert, default is env variable MTLS_CLIENT_CERT
     * @param {string|null} key optional private key for client cert, default will get key from secret store
     * @param {string|null} ca optional root ca bundle to trust, default is env variable MTLS_ROOT_CA
     */
    constructor(bsn, client) {
        this.bsn = bsn;
        this.endpoint = process.env.UITKERING_API_URL;
        this.apiClient = client ? client : new ApiClient();
    }

    /**
     * Request data from the API. 
     * @returns {string} XML string with uitkeringsdata
     */
    async requestData() {
        return this.apiClient.requestData(this.endpoint, this.body(this.bsn), {
            'Content-type': 'text/xml',
            'SoapAction': this.endpoint + '/getData'
        });
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