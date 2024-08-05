import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Aspects, Stack, StackProps, Stage, StageProps, Tags } from 'aws-cdk-lib';
import { ApiKey, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { ApiStack } from './ApiStack';
import { ZaakgerichtwerkenFunction } from './app/zaakgerichtwerken/zaakgerichtwerken-function';
import { CloudfrontStack } from './CloudfrontStack';
import { Configurable } from './Configuration';
import { DNSSECStack } from './DNSSECStack';
import { DNSStack } from './DNSStack';
import { KeyStack } from './keystack';
import { SessionsStack } from './SessionsStack';
import { Statics } from './statics';
import { UsEastStack } from './UsEastStack';
import { WafStack } from './WafStack';

export interface ApiStageProps extends StageProps, Configurable {}

/**
 * Stage responsible for the API Gateway and lambdas
 *
 * The application is accessible via CloudFront on a custom domain. CloudFront has
 * several origins (
 * - S3 for static assets and error pages
 * - API Gateway (v2) for dynamic pages
 *
 * The API Gateway has several routes. This project manages the auth-related routes and
 * the homepage. Separate projects can add routes to the API Gateway for extended functionality.
 *
 */
export class ApiStage extends Stage {
  constructor(scope: Construct, id: string, props: ApiStageProps) {
    super(scope, id, props);

    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);
    Aspects.of(this).add(new PermissionsBoundaryAspect()); // Required for all stages in our LZ (TODO: Subclass Stage/Stack to provide this in our own project type)

    const branchName = props.configuration.branch;

    const keyStack = new KeyStack(this, 'key-stack');
    const sessionsStack = new SessionsStack(this, 'sessions-stack', { key: keyStack.key });
    const dnsStack = new DNSStack(this, 'dns-stack', { configuration: props.configuration });

    const usEastStack = new UsEastStack(this, 'us-cert-stack', { branch: branchName, env: { region: 'us-east-1' } }); // This stack must live in us-east-1
    const dnssecStack = new DNSSECStack(this, 'dnssec-stack', { branch: branchName, env: { region: 'us-east-1' }, applicationRegion: this.region! });
    usEastStack.addDependency(dnsStack);
    dnssecStack.addDependency(dnsStack);

    const apistack = new ApiStack(this, 'api-stack', {
      branch: branchName,
      sessionsTable: sessionsStack.sessionsTable,
      configuration: props.configuration,
    });
    const cloudfrontStack = new CloudfrontStack(this, 'cloudfront-stack', {
      branch: branchName,
      hostDomain: apistack.domain(),
    });
    cloudfrontStack.addDependency(usEastStack);

    new WafStack(this, 'waf-stack', { env: { region: 'us-east-1' }, branch: branchName });

    new ZaakAggregatorStack(this, 'zaakaggregator');
  }
}


class ZaakAggregatorStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const api = this.api();

    const resource = api.root.addResource('zaken');
    resource.addMethod('GET', new LambdaIntegration(new ZaakgerichtwerkenFunction(this, 'zgwfunction')), {
      apiKeyRequired: true,
    });
  }

  private api() {
    const api = new RestApi(this, 'zaken', {
      description: 'API Gateway for ZaakAggregator',
    });

    const plan = api.addUsagePlan('plan', {
      description: 'internal use',
    });
    const key = new ApiKey(this, 'apikey', {
      description: 'Internal use for Mijn Nijmegen',
    });
    plan.addApiKey(key);
    plan.node.addDependency(key);
    plan.addApiStage({
      stage: api.deploymentStage,
    });
    return api;
  }
}
