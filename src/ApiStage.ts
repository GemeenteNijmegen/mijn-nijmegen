import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiStack } from './ApiStack';
import { CertificateStack } from './CertificateStack';
import { CloudfrontStack } from './CloudfrontStack';
import { DNSStack } from './DNSStack';
import { KeyStack } from './keystack';
import { SessionsStack } from './SessionsStack';
import { UsEastCertificateStack } from './UsEastCertificateStack';

export interface ApiStageProps extends StageProps {
  branch: string;
}

/**
 * Stage responsible for the API Gateway and lambdas
 */
export class ApiStage extends Stage {
  constructor(scope: Construct, id: string, props: ApiStageProps) {
    super(scope, id, props);
    const keyStack = new KeyStack(this, 'key-stack');
    const sessionsStack = new SessionsStack(this, 'sessions-stack', { key: keyStack.key });
    const dnsStack = new DNSStack(this, 'dns-stack', { branch: props.branch });
    const certificateStack = new CertificateStack(this, 'cert-stack', { branch: props.branch });
    certificateStack.createCertificate(dnsStack.zone);

    certificateStack.addDependency(dnsStack);

    const usEastCertificateStack = new UsEastCertificateStack(this, 'us-cert-stack', { branch: props.branch, env: { region: 'us-east-1' } });
    usEastCertificateStack.addDependency(dnsStack);

    const apistack = new ApiStack(this, 'api-stack', {
      branch: props.branch,
      sessionsTable: sessionsStack.sessionsTable,
    });

    const cloudfrontStack = new CloudfrontStack(this, 'cloudfront-stack', {
      branch: props.branch,
      hostDomain: apistack.domain(),
    });
    cloudfrontStack.addDependency(usEastCertificateStack);
  }
}