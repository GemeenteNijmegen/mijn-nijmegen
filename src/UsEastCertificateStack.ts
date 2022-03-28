import { aws_certificatemanager as CertificateManager, Stack, StackProps, aws_ssm as SSM } from 'aws-cdk-lib';
import { HostedZone, IHostedZone } from 'aws-cdk-lib/aws-route53';
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
    const parameters = new RemoteParameters(this, 'params', {
      path: `${Statics.ssmZonePath}/`,
      region: 'eu-west-1',
    });
    const zone = HostedZone.fromHostedZoneAttributes(this, 'zone',
      this.getZoneAttributesFromEuWest(parameters, Statics.ssmZoneIdNew, Statics.ssmZoneNameNew),
    );
    const nijmegenZone = HostedZone.fromHostedZoneAttributes(this, 'nijmegen-zone',
      this.getZoneAttributesFromEuWest(parameters, Statics.ssmNijmegenZoneIdNew, Statics.ssmNijmegenZoneNameNew),
    );
    this.createCertificateWithMultiZone(zone, nijmegenZone);
  }

  getZoneAttributesFromEuWest(parameters: RemoteParameters, id: string, name: string): { hostedZoneId: string; zoneName: string} {
    const zoneId = parameters.get(id);
    const zoneName = parameters.get(name);
    return {
      hostedZoneId: zoneId,
      zoneName: zoneName,
    };
  }

  createCertificateWithMultiZone(zone: IHostedZone, nijmegenZone: IHostedZone) {
    const subdomain = Statics.subDomain(this.branch);
    const cspDomain = `${subdomain}.csp-nijmegen.nl`;

    const certificate = new CertificateManager.Certificate(this, 'certificate', {
      domainName: cspDomain,
      subjectAlternativeNames: [`${subdomain}.nijmegen.nl`],
      validation: CertificateManager.CertificateValidation.fromDnsMultiZone({
        [cspDomain]: zone,
        [`${subdomain}.nijmegen.nl`]: nijmegenZone,
      }),
    });

    new SSM.StringParameter(this, 'cert-arn', {
      stringValue: certificate.certificateArn,
      parameterName: Statics.certificateArn,
    });

    return certificate;
  }
}