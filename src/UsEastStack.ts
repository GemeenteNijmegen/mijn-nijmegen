import { RemoteParameters } from '@gemeentenijmegen/cross-region-parameteres';
import { aws_certificatemanager as CertificateManager, aws_ssm as SSM, Stack, StackProps } from 'aws-cdk-lib';
import { Alarm, ComparisonOperator, Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { CfnHealthCheck, HealthCheckType } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './statics';

export interface UsEastStackProps extends StackProps, Configurable {
}

/**
 * Creates a TLS certificate for use by Cloudfront.
 *
 * TLS certificates must live in the us-east-1 region, for use with Cloudfront. ('global' services usually are located in us-east-1).
 * This stack must be created in us-east-1. We set an SSM Parameter in this stack, which wil be used in the Cloudfront stack.
 */
export class UsEastStack extends Stack {
  private branch: string;

  constructor(scope: Construct, id: string, props: UsEastStackProps) {
    super(scope, id, props);
    this.branch = props.configuration.branch;
    this.createCertificate();
    if (props.configuration.monitorLoginPage != false) {
      this.monitorLoginPage(this.branch);
    }
  }

  /**
   * The hosted zone is a subdomain of csp-nijmegen.nl. We use a CNAME in nijmegen.nl to reference this subdomain. The certificate
   * must be valid for both domains. Domain validation for csp-nijmegen.nl is automatic, unfortunately, domain validation for nijmegen.nl
   * is a manual activity. Since the CNAME records for validation are fixed, you CAN manually request a certificate for both domains,
   * note the validation record, add this to Nijmegen DNS, remove your certificate and then deploy this, to not have to wait for validation
   * when deploying.
   */
  private createCertificate() {
    const subdomain = Statics.subDomain(this.branch);
    const cspSubdomain = Statics.cspSubDomain(this.branch);
    const appDomain = `${subdomain}.nijmegen.nl`;
    const cspDomain = `${cspSubdomain}.csp-nijmegen.nl`;

    const certificate = new CertificateManager.Certificate(this, 'certificate', {
      domainName: appDomain,
      subjectAlternativeNames: [cspDomain],
      validation: CertificateManager.CertificateValidation.fromDns(),
    });

    new SSM.StringParameter(this, 'cert-arn', {
      stringValue: certificate.certificateArn,
      parameterName: Statics.certificateArn,
    });
  }


  /**
   * Setup route53 health checks
   *
   * This method sets a health check on the login page, checking for a valid
   * http response, and the presence of a specific string on the page.
   *
   * @param branch the deployment branch (determines domain to monitor)
   */
  private monitorLoginPage(branch: string) {
    const domain = `${Statics.subDomain(branch)}.nijmegen.nl`;

    // Create health check using native CDK Route53 construct
    const healthCheck = new CfnHealthCheck(this, 'healthcheck', {
      healthCheckConfig: {
        type: HealthCheckType.HTTPS_STR_MATCH,
        fullyQualifiedDomainName: domain,
        port: 443,
        resourcePath: '/login',
        searchString: 'Inloggen Mijn Nijmegen',
        requestInterval: 30,
        failureThreshold: 3,
      },
    });

    new Alarm(this, 'healthcheck-alarm', {
      alarmName: 'mijn-nijmegen-healthcheck-critical-lvl',
      metric: new Metric({
        metricName: 'HealthCheckStatus',
        namespace: 'AWS/Route53',
        dimensionsMap: {
          HealthCheckId: healthCheck.attrHealthCheckId,
        },
      }),
      comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
      threshold: 1,
      evaluationPeriods: 1,
    });
  }
}
