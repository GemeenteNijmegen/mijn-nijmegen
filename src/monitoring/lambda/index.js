const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const util = require('util');
const axios = require('axios');

function parseData(data) {
    const payload = Buffer.from(data, 'base64');
    const result = zlib.gunzipSync(payload);
    const json = JSON.parse(result.toString('utf-8'));
    return json;
}
exports.parseData = parseData;

function createMessage(logs) {
    const logGroup = logs.logGroup;
    const logStream = logs.logStream;
    const logEvents = logs.logEvents;
    
    const templateBuffer = fs.readFileSync(path.join(__dirname, 'template.json'));
    const templateString = templateBuffer.toString();
    const message = { blocks: [] };
    for (let i = 0; i < logEvents.length; i++) {
        const event = logEvents[i];
        let blockString = templateString.replace('<HEADER>', 'Error in Mijn Nijmegen lambda');
        blockString = blockString.replace('<LOGGROUP>', logGroup);
        let eventMessage = JSON.stringify('```' + event.message + '```');
        
        blockString = blockString.replace('<MESSAGE>', eventMessage);
        const urlBase = 'https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#logsV2:log-groups/log-group';
        const urlString = urlBase + encodeURIComponent(logGroup) + '/log-events/' + encodeURIComponent(logStream);
        blockString = blockString.replace('<URL>', urlString);
        const block = JSON.parse(blockString);
        message.blocks = message.blocks.concat(block);
    }
    return message;
}
exports.createMessage = createMessage;

function sendMessage(message) {
    axios.post(process.env.SLACK_WEBHOOK_URL, message);
}

async function handler(input, context) {
    const logs = parseData(input.awslogs.data);
    const message = createMessage(logs);
    sendMessage(message);

};
exports.handler = handler;