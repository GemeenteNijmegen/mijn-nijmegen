const xml2js = require('xml2js');
const ObjectMapper = require('object-mapper');
const { ApiClient } = require('./ApiClient');

class UitkeringsApi {
    constructor(client) {
        this.client = client ? client : new ApiClient(bsn);
        this.endpoint = process.env.UITKERING_API_URL;
    }

    async getUitkeringen(bsn) {
        const data = await this.client.requestData(this.endpoint, this.body(this.bsn), {
            'Content-type': 'text/xml',
            'SoapAction': this.endpoint + '/getData'
        });
        const object = await xml2js.parseStringPromise(data);
        const uitkeringsRows =  this.mapUitkeringsRows(object);
        let uitkeringen = this.mapUitkering(uitkeringsRows);
        if(uitkeringen) {
            uitkeringen = this.addFieldsByName(uitkeringen);
            return uitkeringen;
        }
        return {'uitkeringen': []};
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

    mapUitkeringsRows(object) {
        const map = {
            'soap:Envelope.soap:Body[0].mij:dataResponse[0].groups[].group[0]': {
                key: 'uitkeringen',
                transform: ((value) => {
                    if(!value) { return null; }
                    const groups = value.filter((group) => {
                        return group.groupName[0] == 'uitkeringen';
                    });
                    return groups[0].rows[0]
                })
            }
        }
        return ObjectMapper(object, map);
    }

    mapUitkering(object) {
        const map = {
            'uitkeringen.row[].pageName[0]': 'uitkeringen[].type',
            'uitkeringen.row[].fields[0].field[].name[0]': 'uitkeringen[].fields[].label',
            'uitkeringen.row[].fields[0].field[].value[0]': 'uitkeringen[].fields[].value',
        };
        return ObjectMapper(object, map);
    }

    addFieldsByName(uitkeringen) {
        uitkeringen.uitkeringen.forEach((uitkering) => {
            const fieldsByName = uitkering.fields?.map((field) => {
                let obj = {};
                let label = field.label.toLowerCase().replace(/\s+/g, '-');
                obj[label] = field.value;
                return obj;
            });
            uitkering.fieldsByName = fieldsByName;
        });
        return uitkeringen;
    }
}

exports.UitkeringsApi = UitkeringsApi;