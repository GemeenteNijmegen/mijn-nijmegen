const xml2js = require('xml2js');
const ObjectMapper = require('object-mapper');
const { FileConnector } = require("./FileConnector");

class UitkeringsApi {
    constructor(bsn, Connector) {
        this.bsn = bsn;
        console.debug(typeof Connector);
        this.connector = new Connector(bsn);
    }

    async getUitkeringen() {
        let data = await this.connector.requestData();
        const object = await xml2js.parseStringPromise(data);
        const uitkeringsRows =  this.mapUitkeringsRows(object);
        let uitkeringen = this.mapUitkering(uitkeringsRows);
        if(uitkeringen) {
            uitkeringen = this.addFieldsByName(uitkeringen);
            return uitkeringen;
        }
        return {'uitkeringen': []};
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