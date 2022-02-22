import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiStack } from './ApiStack';
import { DNSStack } from './DNSStack';
import { SessionsStack } from './SessionsStack';

export interface ApiStageProps extends StageProps {
  branch: string;
}

/**
 * Stage responsible for the API Gateway and lambdas
 */
export class ApiStage extends Stage {
  constructor(scope: Construct, id: string, props: ApiStageProps) {
    super(scope, id, props);
    const sessionsStack = new SessionsStack(this, 'sessions-stack');
    new ApiStack(this, 'api-stack', { sessionsTable: sessionsStack.sessionsTable });
    new DNSStack(this, 'mijn-uitkering-dns', { branch: props.branch });
  }
}
