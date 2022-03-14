import { aws_certificatemanager as CertificateManager, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './statics';

export interface CertificateStackProps extends StackProps {
  branch: string;
}

export class CertificateStack extends Stack {
  certificate: CertificateManager.Certificate;
  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id);
    const subdomain = Statics.subDomain(props.branch);
    this.certificate = new CertificateManager.Certificate(this, 'certificate', {
      domainName: `${subdomain}.csp-nijmegen.nl`,
      validation: CertificateManager.CertificateValidation.fromDns(), // No hosted zones added because records need to be manually added to Nijmegen DNS.
    });
  }

}
