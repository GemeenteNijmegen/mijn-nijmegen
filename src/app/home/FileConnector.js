const fs = require('fs');
const path = require('path');

class FileConnector {
    constructor(bsn) {
        this.bsn = bsn;
    }

    async requestData() {
        const filePath = path.join('tests/responses', this.bsn + '.xml');
        return await this.getStringFromFilePath(filePath)
            .then((data) => { return [data]; })
            .catch((err) => { return []; });
    }

    async getStringFromFilePath(filePath) {
        return new Promise((res, rej) => {
            fs.readFile(path.join(__dirname, filePath), (err, data) => {
                if (err)
                    return rej(err);
                return res(data.toString());
            });
        });
    }
}
exports.FileConnector = FileConnector;