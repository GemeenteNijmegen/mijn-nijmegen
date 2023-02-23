import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { handleRequest } from "./handleRequest";

const dynamoDBClient = new DynamoDBClient();
const apiClient = new ApiClient();
await apiClient.init();

function parseEvent(event) {
    return { 
        'cookies': event?.cookies?.join(';'),
        'code': event?.queryStringParameters?.code,
        'state': event?.queryStringParameters?.state
    };
}

export async function handler(event, context) {
    try {
        const params = parseEvent(event);
        return await handleRequest(params.cookies, params.code, params.state, dynamoDBClient, apiClient);
    } catch (err) {
        console.error(err);
        return Response.error(500);
    }
}