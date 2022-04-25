const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { handleRequest } = require("./handleRequest");

const dynamoDBClient = new DynamoDBClient();

function parseEvent(event) {
    return { 
        'cookies': event?.cookies?.join(';'),
        'code': event?.queryStringParameters?.code,
        'state': event?.queryStringParameters?.state
    };
}

exports.handler = async (event, context) => {
    try {
        const params = parseEvent(event);
        return await handleRequest(params.cookies, params.code, params.state, dynamoDBClient);
    } catch (err) {
        console.error(err);
        response = {
            'statusCode': 500
        }
        return response;
    }
};