import { aws_certificatemanager as CertificateManager, Stack, StackProps } from 'aws-cdk-lib';
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
  }

  createCertificate(zone: HostedZone) {
    const subdomain = Statics.subDomain(this.branch);

    const certificate = new CertificateManager.DnsValidatedCertificate(this, 'certificate', {
      domainName: `${subdomain}.csp-nijmegen.nl`,
      hostedZone: zone,
      subjectAlternativeNames: [`${subdomain}.nijmegen.nl`],
      region: 'us-east-1',
    });
    return certificate;
  }
}