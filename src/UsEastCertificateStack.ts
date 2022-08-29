import { aws_certificatemanager as CertificateManager, Stack, StackProps, aws_ssm as SSM } from 'aws-cdk-lib';
import { RemoteParameters } from 'cdk-remote-stack';
import { Construct } from 'constructs';
import { Statics } from './statics';

export interface UsEastCertificateStackProps extends StackProps {
  branch: string;
}

export class UsEastCertificateStack extends Stack {
  private branch: string;

  constructor(scope: Construct, id: string, props: UsEastCertificateStackProps) {
    super(scope, id, props);
    this.branch = props.branch;
    this.createCertificate();
  }

  getZoneAttributesFromEuWest(parameters: RemoteParameters, id: string, name: string): { hostedZoneId: string; zoneName: string} {
    const zoneId = parameters.get(id);
    const zoneName = parameters.get(name);
    return {
      hostedZoneId: zoneId,
      zoneName: zoneName,
    };
  }

  createCertificate() {
    const subdomain = Statics.subDomain(this.branch);
    const cspSubdomain = Statics.cspSubDomain(this.branch);
    const appDomain = `${subdomain}.nijmegen.nl`;
    const oldCspDomain = `${subdomain}.csp-nijmegen.nl`;
    const cspDomain = `${cspSubdomain}.csp-nijmegen.nl`;

    // On accp old and new csp domain are the same (temp solution until oldCspDomain is decommissioned)
    var subjectAlternativeNames = [cspDomain, oldCspDomain];
    if (cspDomain === oldCspDomain) {
      subjectAlternativeNames = [cspDomain];
    }

    const mijnCcertificate = new CertificateManager.Certificate(this, 'mijn-certificate', {
      domainName: appDomain,
      subjectAlternativeNames: subjectAlternativeNames,
      validation: CertificateManager.CertificateValidation.fromDns(),
    });

    new SSM.StringParameter(this, 'cert-arn', {
      stringValue: mijnCcertificate.certificateArn,
      parameterName: Statics.certificateArn,
    });

  }
}