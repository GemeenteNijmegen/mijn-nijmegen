import { EndpointHealthCheck } from '@pepperize/cdk-route53-health-check';
import { aws_certificatemanager as CertificateManager, Stack, StackProps, aws_ssm as SSM } from 'aws-cdk-lib';
import { Alarm, ComparisonOperator } from 'aws-cdk-lib/aws-cloudwatch';
import { RemoteParameters } from 'cdk-remote-stack';
import { Construct } from 'constructs';
import { Statics } from './statics';

export interface UsEastStackProps extends StackProps {
  branch: string;
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
    this.branch = props.branch;
    this.createCertificate();
    this.monitorLoginPage(props.branch);
  }

  /** Because the hosted zone SSM parameters are stored in eu-west-1,
   * we use the 'remoteParameters'-package to retrieve these cross-region.
   */
  getZoneAttributesFromEuWest(parameters: RemoteParameters, id: string, name: string): { hostedZoneId: string; zoneName: string} {
    const zoneId = parameters.get(id);
    const zoneName = parameters.get(name);
    return {
      hostedZoneId: zoneId,
      zoneName: zoneName,
    };
  }

  /**
   * The hosted zone is a subdomain of csp-nijmegen.nl. We use a CNAME in nijmegen.nl to reference this subdomain. The certificate
   * must be valid for both domains. Domain validation for csp-nijmegen.nl is automatic, unfortunately, domain validation for nijmegen.nl
   * is a manual activity. Since the CNAME records for validation are fixed, you CAN manually request a certificate for both domains,
   * note the validation record, add this to Nijmegen DNS, remove your certificate and then deploy this, to not have to wait for validation
   * when deploying.
   */
  createCertificate() {
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
  monitorLoginPage(branch: string) {
    const domain = `${Statics.subDomain(branch)}.nijmegen.nl`;
    const healthCheck = new EndpointHealthCheck(this, 'healthcheck', {
      domainName: domain,
      resourcePath: '/login',
      searchString: 'Inloggen Mijn Nijmegen',
    });

    new Alarm(this, 'healthcheck-alarm', {
      alarmName: 'mijn-nijmegen-healthcheck-critical-lvl',
      metric: healthCheck.metricHealthCheckStatus(),
      comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
      threshold: 1,
      evaluationPeriods: 1,
    });
  }
}
