import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiStack } from './ApiStack';
import { CertificateStack } from './CertificateStack';
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
    const certificateStack = new CertificateStack(this, 'cert-stack', { branch: props.branch, env: { region: 'us-east-1' } });
    const apiStack = new ApiStack(this, 'api-stack', {
      branch: props.branch,
      sessionsTable: sessionsStack.sessionsTable,
      certificateArn: certificateStack.certificate.certificateArn,
    });
    const dnsStack = new DNSStack(this, 'mijn-uitkering-dns', { branch: props.branch });
    dnsStack.addCloudFrontRecords(apiStack.cloudfrontDistribution);
  }
}
