const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const ObjectMapper = require('object-mapper');

class UitkeringsApi {
    constructor(bsn, Connector) {
        this.bsn = bsn;
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

class FileConnector {
    constructor(bsn) {
        this.bsn = bsn;
    }

    async requestData() {
        const filePath = path.join('tests/responses', this.bsn + '.xml');
        return await this.getStringFromFilePath(filePath)
        .then((data) => { return [data] })
        .catch((err) => { return [] });
    }

    async getStringFromFilePath(filePath) {
        return new Promise((res, rej) => {
            fs.readFile(path.join(__dirname, filePath), (err, data) => {
                if (err) return rej(err);
                return res(data.toString());
            });
        });
    }
}

exports.UitkeringsApi = UitkeringsApi;
exports.FileConnector = FileConnector;