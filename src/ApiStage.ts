import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Aspects, Stage, StageProps, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiStack } from './ApiStack';
import { CloudfrontStack } from './CloudfrontStack';
import { Configurable } from './Configuration';
import { DNSSECStack } from './DNSSECStack';
import { DNSStack } from './DNSStack';
import { KeyStack } from './keystack';
import { SessionsStack } from './SessionsStack';
import { Statics } from './statics';
import { UsEastCertificateStack } from './UsEastCertificateStack';
import { WafStack } from './WafStack';

export interface ApiStageProps extends StageProps, Configurable {}

/**
 * Stage responsible for the API Gateway and lambdas
 */
export class ApiStage extends Stage {
  constructor(scope: Construct, id: string, props: ApiStageProps) {
    super(scope, id, props);

    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);
    Aspects.of(this).add(new PermissionsBoundaryAspect());

    const branchName = props.configuration.branch;

    const keyStack = new KeyStack(this, 'key-stack');
    const sessionsStack = new SessionsStack(this, 'sessions-stack', { key: keyStack.key });
    const dnsStack = new DNSStack(this, 'dns-stack', { configuration: props.configuration });

    const usEastCertificateStack = new UsEastCertificateStack(this, 'us-cert-stack', { branch: branchName, env: { region: 'us-east-1' } });
    const dnssecStack = new DNSSECStack(this, 'dnssec-stack', { branch: branchName, env: { region: 'us-east-1' }, applicationRegion: this.region! });
    usEastCertificateStack.addDependency(dnsStack);
    dnssecStack.addDependency(dnsStack);

    const apistack = new ApiStack(this, 'api-stack', {
      branch: branchName,
      sessionsTable: sessionsStack.sessionsTable,
    });
    const cloudfrontStack = new CloudfrontStack(this, 'cloudfront-stack', {
      branch: branchName,
      hostDomain: apistack.domain(),
    });
    cloudfrontStack.addDependency(usEastCertificateStack);

    new WafStack(this, 'waf-stack', { env: { region: 'us-east-1' }, branch: branchName });
  }
}
