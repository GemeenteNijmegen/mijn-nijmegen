const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { homeRequestHandler } = require("./homeRequestHandler");

const dynamoDBClient = new DynamoDBClient();

function parseEvent(event) {
    return { 
        'cookies': event?.cookies?.join(';'),
    };
}

exports.handler = async (event, context) => {
    try {
        const params = parseEvent(event);
        return await homeRequestHandler(params.cookies, dynamoDBClient);
    
    } catch (err) {
        console.error(err);
        response = {
            'statusCode': 500
        }
        return response;
    }
};