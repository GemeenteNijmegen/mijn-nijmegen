import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiStack } from './ApiStack';
import { CertificateStack } from './CertificateStack';
import { CloudfrontStack } from './CloudfrontStack';
import { DNSStack } from './DNSStack';
import { KeyStack } from './keystack';
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
    const keyStack = new KeyStack(this, 'key-stack');
    const sessionsStack = new SessionsStack(this, 'sessions-stack', { key: keyStack.key });
    const dnsStack = new DNSStack(this, 'dns-stack', { branch: props.branch });
    const certificateStack = new CertificateStack(this, 'cert-stack', { branch: props.branch });
    const certificate = certificateStack.createCertificate(dnsStack.zone, dnsStack.fakeNijmegenZone);
    certificateStack.addDependency(dnsStack);
    const apistack = new ApiStack(this, 'api-stack', {
      branch: props.branch,
      sessionsTable: sessionsStack.sessionsTable,
    });

    new CloudfrontStack(this, 'cloudfront-stack', {
      branch: props.branch,
      certificateArn: certificate.certificateArn,
      hostDomain: apistack.domain(),
    });
  }
}