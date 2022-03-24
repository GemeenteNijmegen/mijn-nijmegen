import { aws_certificatemanager as CertificateManager, aws_ssm as SSM, Stack, StackProps } from 'aws-cdk-lib';
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

  createCertificate(zone: HostedZone, fakeNijmegenZone: HostedZone) {
    const subdomain = Statics.subDomain(this.branch);
    const cspDomain = `${subdomain}.csp-nijmegen.nl`;
    const nijmegenDomain = `${subdomain}.nijmegen.nl`;

    const certificate = new CertificateManager.Certificate(this, 'certificate', {
      domainName: cspDomain,
      subjectAlternativeNames: [nijmegenDomain],
      validation: CertificateManager.CertificateValidation.fromDnsMultiZone({
        cspDomain: zone,
        nijmegenDomain: fakeNijmegenZone
      })
    });
    
    new SSM.StringParameter(this, 'certificate-arn', {
      parameterName: Statics.certificateArn,
      stringValue: certificate.certificateArn,
    });
    
    return certificate;
  }
}