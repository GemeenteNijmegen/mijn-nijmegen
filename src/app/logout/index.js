const { handleLogoutRequest } = require("./handleLogoutRequest");
 const { Response } = require('@gemeentenijmegen/apigateway-http/lib/V2/Response');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

const dynamoDBClient = new DynamoDBClient();

function parseEvent(event) {
    return { 
        'cookies': event?.cookies?.join(';')
    };
}

exports.handler = async (event, context) => {
    try {
        const params = parseEvent(event);
        return await handleLogoutRequest(params.cookies, dynamoDBClient);
    } catch (err) {
        console.error(err);
        Response.error(500);
    }
};