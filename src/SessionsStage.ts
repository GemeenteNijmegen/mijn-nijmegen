import { Stage } from 'aws-cdk-lib'
import { Construct } from 'constructs';
import { SessionsStack } from './SessionsStack'

export class SessionsStage extends Stage {
    constructor(scope: Construct, id: string, props: {}) {
        super(scope, id, props);
        new SessionsStack(this, 'sessions-stack');
    }
}