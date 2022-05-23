const cookie = require('cookie');
const crypto = require('crypto');
const { GetItemCommand, PutItemCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");

class Session {
    sessionId = false;
    // state parameter to validate OpenIDConnect response
    state = false;;
    
    /**
     * Session handler
     * 
     * Construct a session object and pass the lambda event object. 
     * call init() to get the current session state. create or update 
     * sessions as needed.
     * @param {object} event the event object provided to the lambda
     */
    constructor(event, dynamoDBClient) {
        this.sessionId = this.getSessionId(event);
        this.dbClient = dynamoDBClient;
    }

    /**
     * Parses the cookie string for the session id.
     * @param {object} cookiestring a standard cookie header value
     * @returns string | false
     */
    getSessionId(cookieString) {
        if(!cookieString) { return false; }
        const cookies = cookie.parse(cookieString);
        if(cookies?.session != '') {
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
            console.error('Error getting session from DynamoDB: ' + err);
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
        if(!this.sessionId) { 
            throw new Error('no sessionid, cannot update empty session'); 
        }
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
            console.error('Error updating session in DynamoDB: ' + err);
            throw err;
        }
    }

    /**
     * Create a new session, store in dynamodb
     */
    async createSession(state) {
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

    /**
     * Create a new session, store in dynamodb
     */
     async createLoggedInSession(bsn) {
        const sessionId = crypto.randomUUID();
        const now = new Date();
        const ttl = Math.floor((now / 1000) + 15 * 60).toString(); // ttl is 15 minutes

        const command = new PutItemCommand({
            TableName: process.env.SESSION_TABLE,
            Item: {
                'sessionid': { S: sessionId },
                'bsn': { S: bsn },
                'ttl': { N: ttl },
                'loggedin': { BOOL: true }
            }
        });
        await this.dbClient.send(command);
        this.sessionId = sessionId;
        return sessionId;
    }

    getCookie() {
        const cookieString = cookie.serialize('session', this.sessionId, {
            httpOnly: true,
            secure: true
        });
        return cookieString;
    }
}
exports.Session = Session;