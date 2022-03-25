import { aws_certificatemanager as CertificateManager, CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { Statics } from './statics';

export interface CertificateStackProps extends StackProps {
  branch: string;
}

export class CertificateStack extends Stack {
  private branch: string;
  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);
    this.branch = props.branch;

    //Add output to prevent issue deploying since cloudfront stack used to depend on this
    //TODO: Remove after cloudfront stack is updated in prod (to not use the certificate from this stack)
    const compat_output = new CfnOutput(this, 'temp-output', {
      value: 'arn:aws:acm:us-east-1:315037222840:certificate/46fb27ad-3a5c-4c70-8a62-1ff27573c18f',
      exportName: 'mijn-api-cert-stack:ExportsOutputFnGetAttcertificateCertificateRequestorResourceFD86DD58ArnFFEE9192',
    });
    compat_output.overrideLogicalId('ExportsOutputFnGetAttcertificateCertificateRequestorResourceFD86DD58ArnFFEE9192');
  }

  createCertificate(zone: HostedZone) {
    const subdomain = Statics.subDomain(this.branch);

    const certificate = new CertificateManager.DnsValidatedCertificate(this, 'certificate', {
      domainName: `${subdomain}.csp-nijmegen.nl`,
      hostedZone: zone,
      // subjectAlternativeNames: [`${subdomain}.nijmegen.nl`],
      region: 'us-east-1',
    });
    return certificate;
  }
}