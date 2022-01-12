const cookie = require('cookie');
const crypto = require('crypto');
const { generators } = require('openid-client');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { GetItemCommand, PutItemCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");

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

    async init() {
        console.debug('init session');
        this.dbClient = new DynamoDBClient();
        console.debug(this.dbClient);
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
        console.debug('start session update');
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
        console.debug('end session update. State: ' + this.state);
    }

    async createSession() {
        console.debug('start session create');
        const state = generators.state();
        const sessionId = crypto.randomUUID();
        const now = new Date();
        const ttl = Math.floor((now / 1000) + 15 * 60).toString(); // ttl is 15 minutes

        console.debug('BEFORE command');
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
        console.debug('BEFORE dbClient send');
        await this.dbClient.send(command);
        console.debug('AFTER dbClient send');
        this.state = state;
        this.sessionId = sessionId;
        console.debug('end session create. sessId: ' + this.sessionId + ' state: ' + this.state);
    }
}
exports.Session = Session;