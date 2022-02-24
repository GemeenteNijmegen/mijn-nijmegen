const cookie = require('cookie');
const crypto = require('crypto');
const { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");

class Session {
    sessionId = false;
    // state parameter to validate OpenIDConnect response
    state = false;
    
    /**
     * Session handler
     * 
     * Construct a session object and pass the lambda event object. 
     * call init() to get the current session state. create or update 
     * sessions as needed.
     * @param {object} event the event object provided to the lambda
     */
    constructor(event) {
        this.sessionId = this.getSessionId(event);
    }

    /**
     * Parses the cookie string for the session id.
     * @param {object} cookiestring a standard cookie header value
     * @returns string | false
     */
    getSessionId(cookieString) {
        if(!cookieString) { return false; }
        const cookies = cookie.parse(cookieString);
        if ('session' in cookies) {
            return cookies.session;
        }
        return false;
    }

    /**
     * Get the current session state from dynamodb,
     * set instance variables on the Session object.
     * 
     * @returns dynamodb record | false
     */
    async init() {
        console.debug('init session');
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
            if (session.Item?.loggedin !== undefined) {
                this.session = session;
                this.state = session.Item?.state?.S;
                return session;
            } else {
                return false;
            }
        } catch (err) {
            console.debug('Error getting session from DynamoDB: ' + err);
            throw err;
        }
    }
    /**
     * Check the current session state for login state. Call after init()
     * @returns bool
     */
    isLoggedIn() {
        if (this.session) {
            return this.session.Item.loggedin.BOOL;
        }
        return false;
    }

    getValue(key, type = 'S') {
        return this.session?.Item?.[key]?.[type];
    }

    /**
     * Update the session with login state and / or BSN
     * 
     * @param {bool} loggedin set the loggedin state
     * @param {string} bsn set the current user bsn
     */
    async updateSession(loggedin = false, bsn = '') {
        console.debug('start session update');
        console.debug({ 'sessid': this.sessionId, 'bsn': bsn.substring(0, 2), 'loggedin': loggedin });
        const now = new Date();
        const ttl = Math.floor((now / 1000) + 15 * 60).toString(); // ttl is 15 minutes

        /**
         * ttl is a reserved keyword in dynamodb, so we need to set
         * an alias in the ExpressionAttributeNames
         */
        const command = new UpdateItemCommand({
            TableName: process.env.SESSION_TABLE,
            Key: {
                'sessionid': { S: this.sessionId }
            },
            UpdateExpression: 'SET #ttl = :ttl, #loggedin = :loggedin, #bsn = :bsn',
            ExpressionAttributeNames: {
                '#ttl': 'ttl',
                '#loggedin': 'loggedin',
                '#bsn': 'bsn'
            },
            ExpressionAttributeValues: {
                ':ttl': { N: ttl },
                ':loggedin': { BOOL: loggedin },
                ':bsn': { S: bsn }
            }
        });
        try {
            await this.dbClient.send(command);
        } 
        catch (err) {
            console.debug('Error updating session in DynamoDB: ' + err);
            throw err;
        }
        console.debug('end session update. State: ' + this.state);
    }

    /**
     * Create a new session, store in dynamodb
     */
    async createSession(state) {
        console.debug('start session create');
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
        await this.dbClient.send(command);
        this.state = state;
        this.sessionId = sessionId;
        console.debug('end session create. sessId: ' + this.sessionId + ' state: ' + this.state);
    }
}
exports.Session = Session;