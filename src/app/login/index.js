const { handleLoginRequest } = require("./loginRequestHandler");
 const { Response } = require('@gemeentenijmegen/apigateway-http/lib/V2/Response');
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
        Response.error(500);
    }
};