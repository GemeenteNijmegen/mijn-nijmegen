import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiStack } from './ApiStack';
import { CloudfrontStack } from './CloudfrontStack';
import { SessionsStack } from './SessionsStack';

export interface ApiStageProps extends StageProps {
}

/**
 * Stage responsible for the API Gateway and lambdas
 */
export class ApiStage extends Stage {
  constructor(scope: Construct, id: string, props: ApiStageProps) {
    super(scope, id, props);
    const sessionsStack = new SessionsStack(this, 'sessions-stack');
    const apiStack = new ApiStack(this, 'api-stack', { sessionsTable: sessionsStack.sessionsTable });
    new CloudfrontStack(this, 'cf-stack', { ApiGatewayDomain: apiStack.apiGatewayDomain });
  }
}
