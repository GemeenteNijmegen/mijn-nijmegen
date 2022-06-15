const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

function parseData(data) {
    const payload = Buffer.from(data, 'base64');
    const result = zlib.gunzipSync(payload);
    const json = JSON.parse(result.toString('utf-8'));
    return json;
}
exports.parseData = parseData;

function formatCloudwatchUrl(logGroup, logStream, timestamp) {
    const urlBase = 'https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#logsV2:log-groups/log-group/';
    let urlString = urlBase + formatCloudwatchUrlString(logGroup) + '/log-events/' + formatCloudwatchUrlString(logStream);
    if(timestamp) { 
        const millis = 5000;
        const timestampStart = timestamp - millis;
        const timestampEnd = timestamp + millis;
        urlString = urlString + '$3Fstart$3D' + timestampStart + '$26end$3D' + timestampEnd; 
    }
    return urlString;
}

function formatCloudwatchUrlString(string) {
    return string.replace(/\$/g, '$2524').replace(/\//g, '$252F').replace(/\[/g, '$255B').replace(/\]/g, '$255D');
}

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
        const urlString = formatCloudwatchUrl(logGroup, logStream, event.timestamp);
        blockString = blockString.replace('<URL>', urlString);
        const block = JSON.parse(blockString);
        message.blocks = message.blocks.concat(block);
    }
    return message;
}
exports.createMessage = createMessage;

async function sendMessage(message) {
    await axios.post(process.env.SLACK_WEBHOOK_URL, message);
}

async function handler(input, context) {
    const logs = parseData(input.awslogs.data);
    const message = createMessage(logs);
    await sendMessage(message);
};

exports.handler = handler;