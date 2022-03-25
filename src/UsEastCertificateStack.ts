import { aws_certificatemanager as CertificateManager, Stack, StackProps } from 'aws-cdk-lib';
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

    const zone = HostedZone.fromHostedZoneAttributes(this, 'zone',
      this.getZoneAttributesFromEuWest(Statics.ssmZoneId, Statics.ssmZoneName),
    );
    const nijmegenZone = HostedZone.fromHostedZoneAttributes(this, 'nijmegen-zone',
      this.getZoneAttributesFromEuWest(Statics.ssmNijmegenZoneId, Statics.ssmNijmegenZoneName),
    );
    this.createCertificateWithMultiZone(zone, nijmegenZone);
  }

  getZoneAttributesFromEuWest(id: string, name: string): { hostedZoneId: string; zoneName: string} {
    const parameterId = new RemoteParameters(this, `param-${id}`, {
      path: id,
      region: 'eu-west-1',
    });
    const zoneId = parameterId.get(id);
    const parameterName = new RemoteParameters(this, `param-${name}`, {
      path: name,
      region: 'eu-west-1',
    });
    const zoneName = parameterName.get(name);
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
      validation: CertificateManager.CertificateValidation.fromDnsMultiZone({
        [cspDomain]: zone,
        [`${subdomain}.nijmegen.nl`]: nijmegenZone,
      }),
    });

    // new SSM.StringParameter(this, 'cert-arn', {
    //   stringValue: certificate.certificateArn,
    //   parameterName: Statics.certificateArn,
    // });

    return certificate;
  }
}