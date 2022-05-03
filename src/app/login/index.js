const { handleLoginRequest } = require("./loginRequestHandler");
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

const dynamoDBClient = new DynamoDBClient();

function parseEvent(event) {
    return { 'cookies': event?.cookies?.join(';') };
}

exports.handler = async (event, context) => {
    try {
        const params = parseEvent(event);
        const response = await handleLoginRequest(params.cookies, dynamoDBClient);
        return response;
    } catch (err) {
        console.error(err);
        response = {
            'statusCode': 500
        }
        return response;
    }
};