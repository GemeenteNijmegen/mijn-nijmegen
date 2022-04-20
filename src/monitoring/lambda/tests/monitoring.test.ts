import { parseData, createMessage } from '../index';
const fs = require('fs');
const path = require('path');

test('Process logs', async () => {
    
    const filepath = 'logs.json.gz';
    const file_buffer  = fs.readFileSync(path.join(__dirname, filepath));
    const data = file_buffer.toString('base64');
    const logs = parseData(data);
    expect(logs.logGroup).toContain('CloudTrail');

    const message = createMessage(logs);
    expect(message.blocks).toHaveLength(15);
});