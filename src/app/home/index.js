const { ApiClient } = require('./ApiClient');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { requestHandler } = require("./requestHandler");

const dynamoDBClient = new DynamoDBClient();
const apiClient = new ApiClient();

async function init() {
    console.time('init');
    console.timeLog('init', 'start init');
    let promise = apiClient.init();
    console.timeEnd('init');
    return promise;
}

const initPromise = init();

function parseEvent(event) {
    return { 
        'cookies': event?.cookies?.join(';'),
    };
}

exports.handler = async (event, context) => {
    try {
        const params = parseEvent(event);
        await initPromise;
        return await requestHandler(params.cookies, apiClient, dynamoDBClient);
    
    } catch (err) {
        console.debug(err);
        response = {
            'statusCode': 500
        }
        return response;
    }
};
exports.requestHandler = requestHandler;