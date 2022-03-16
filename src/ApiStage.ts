import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiStack } from './ApiStack';
import { CertificateStack } from './CertificateStack';
import { CloudfrontStack } from './CloudfrontStack';
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
    const dnsStack = new DNSStack(this, 'mijn-uitkering-dns', { branch: props.branch });
    const certificateStack = new CertificateStack(this, 'cert-stack', { branch: props.branch });
    const certificate = certificateStack.createCertificate(dnsStack.zone);
    certificateStack.addDependency(dnsStack);
    const apistack = new ApiStack(this, 'api-stack', {
      branch: props.branch,
      sessionsTable: sessionsStack.sessionsTable,
      certificateArn: certificate.certificateArn,
    });
    new CloudfrontStack(this, 'cloudfront-stack', {
      branch: props.branch,
      certificateArn: certificate.certificateArn,
      hostDomain: apistack.domain(),
    });
  }
}