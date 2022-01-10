const cookie = require('cookie');
const crypto = require('crypto');
const { generators } = require('openid-client');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { GetItemCommand, PutItemCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { dbClient } = require("./index");

class Session {
    sessionId = false;
    state = false;
    constructor(event) {
        this.sessionId = this.getSessionId(event);
    }

    getSessionId(event) {
        if ('cookies' in event) {
            const cookies = cookie.parse(event.cookies.join(';'));
            if ('session' in cookies) {
                return cookies.session;
            }
        }
        return false;
    }

    async getSession() {
        this.dbClient = new DynamoDBClient();
        if (!this.sessionId) { return false; }
        const getItemCommand = new GetItemCommand({
            TableName: process.env.SESSION_TABLE,
            Key: {
                'sessionid': { S: this.sessionId }
            }
        });
        try {
            const session = await this.dbClient.send(getItemCommand);
            if ('Item' in session) {
                this.session = session;
                return session;
            } else {
                return false;
            }
        } catch (err) {
            console.log('Error getting session from DynamoDB: ' + err);
            throw err;
        }
    }

    isLoggedIn() {
        if (this.session) {
            return this.session.Item.loggedin.BOOL;
        }
        return false;
    }
    async createOrUpdateSession() {
        if (this.session) {
            this.updateSession();
        } else {
            this.createSession();
        }
    }
    async updateSession() {
        const state = generators.state();
        const now = new Date();
        const ttl = Math.floor((now / 1000) + 15 * 60).toString(); // ttl is 15 minutes

        const command = new UpdateItemCommand({
            TableName: process.env.SESSION_TABLE,
            Key: {
                'sessionid': { S: this.sessionId }
            },
            UpdateExpression: 'SET state = :state, ttl = :ttl, loggedin = :loggedin',
            ExpressionAttributeValues: {
                ':state': { S: state },
                ':ttl': { N: ttl },
                ':loggedin': { BOOL: false }
            }
        });
        await this.dbClient.send(command);
        this.state = state;
    }

    async createSession() {
        const state = generators.state();
        const sessionId = crypto.randomUUID();
        const now = new Date();
        const ttl = Math.floor((now / 1000) + 15 * 60).toString(); // ttl is 15 minutes

        const command = new PutItemCommand({
            TableName: process.env.SESSION_TABLE,
            Item: {
                'sessionid': { S: sessionId },
                'state': { S: state },
                'bsn': { S: '' },
                'ttl': { N: ttl },
                'loggedin': { BOOL: false }
            }
        });
        await this.dbClient.send(command);
        this.state = state;
        this.sessionId = sessionId;
    }
}
exports.Session = Session;
