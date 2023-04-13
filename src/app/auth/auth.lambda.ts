import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { handleRequest } from "./handleRequest";
import { OpenIDConnect } from '../../shared/OpenIDConnect';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const apiClient = new ApiClient();
const OIDC = new OpenIDConnect();

function parseEvent(event: any) {
    return { 
        'cookies': event?.cookies?.join(';'),
        'code': event?.queryStringParameters?.code,
        'state': event?.queryStringParameters?.state
    };
}

export async function handler(event: any, _context: any):Promise<ApiGatewayV2Response> {
    try {
        const params = parseEvent(event);
        return await handleRequest({ 
            cookies: params.cookies, 
            queryStringParamCode: params.code, 
            queryStringParamState: params.state, 
            dynamoDBClient, 
            apiClient,
            OpenIdConnect: OIDC,
        });
    } catch (err) {
        console.error(err);
        return Response.error(500);
    }
}