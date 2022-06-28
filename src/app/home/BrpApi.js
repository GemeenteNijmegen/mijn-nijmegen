const { ApiClient } = require("@gemeentenijmegen/apiclient");
const { Bsn } = require('@gemeentenijmegen/utils');

class BrpApi {
    constructor(client) {
        this.endpoint = process.env.BRP_API_URL ? process.env.BRP_API_URL : 'Irma';
        this.client = client ? client : new ApiClient();
    }

    async getBrpData(bsn) {
        try {
            const aBsn = new Bsn(bsn);
            let data = await this.client.requestData(this.endpoint, {"bsn": aBsn.bsn}, {'Content-type': 'application/json'});
            if(data?.Persoon) {
                return data;
            } else {
                throw new Error('Er konden geen persoonsgegevens opgehaald worden.');
            }
        } catch (error) {
            const data = {
                'error' : error.message
            }
            return data;
        }
    }
}

exports.BrpApi = BrpApi;