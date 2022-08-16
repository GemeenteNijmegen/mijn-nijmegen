import { aws_route53 as Route53, Stack, StackProps, aws_ssm as SSM, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './statics';

export interface DNSStackProps extends StackProps {
  branch: string;
}

export class DNSStack extends Stack {
  zone: Route53.HostedZone;
  accountRootZone: Route53.IHostedZone;
  branch: string;

  constructor(scope: Construct, id: string, props: DNSStackProps) {
    super(scope, id);
    this.branch = props.branch;

    var rootZoneId = SSM.StringParameter.valueForStringParameter(this, Statics.cspRootZoneId);
    var rootZoneName = SSM.StringParameter.valueForStringParameter(this, Statics.cspRootZoneName);
    if (this.branch == 'acceptance') {
      rootZoneId = SSM.StringParameter.valueForStringParameter(this, Statics.accountRootHostedZoneId); // Using the new generic parameter (managed in dns-management)
      rootZoneName = SSM.StringParameter.valueForStringParameter(this, Statics.accountRootHostedZoneName); // Using the new generic parameter (managed in dns-management)
    }

    this.accountRootZone = Route53.HostedZone.fromHostedZoneAttributes(this, 'cspzone', {
      hostedZoneId: rootZoneId,
      zoneName: rootZoneName,
    });

    this.zone = new Route53.HostedZone(this, 'mijn-csp', {
      zoneName: `mijn.${this.accountRootZone.zoneName}`,
    });

    this.addZoneIdAndNametoParams();
    this.addNSToRootCSPzone();
    this.addDomainValidationRecord();
    this.addDsRecord();

    const compat_output = new CfnOutput(this, 'temp-output', {
      value: 'Z03105592Z01S4FRBQZQV',
      exportName: 'mijn-api-dns-stack:ExportsOutputRefmijncspB83B491BB53D10A4',
    });
    compat_output.overrideLogicalId('ExportsOutputRefmijncspB83B491BB53D10A4');
  }

  /**
   * Export zone id and name to parameter store
   * for use in other stages (Cloudfront).
   */
  private addZoneIdAndNametoParams() {
    new SSM.StringParameter(this, 'mijn-hostedzone-id', {
      stringValue: this.zone.hostedZoneId,
      parameterName: Statics.ssmZoneId,
    });

    new SSM.StringParameter(this, 'mijn-hostedzone-name', {
      stringValue: this.zone.zoneName,
      parameterName: Statics.ssmZoneName,
    });

    // Temporarily add params twice, with old and new name
    new SSM.StringParameter(this, 'csp-hostedzone-id', {
      stringValue: this.zone.hostedZoneId,
      parameterName: Statics.ssmZoneIdNew,
    });

    new SSM.StringParameter(this, 'csp-hostedzone-name', {
      stringValue: this.zone.zoneName,
      parameterName: Statics.ssmZoneNameNew,
    });
  }

  /**
   * Add the Name servers from the newly defined zone to
   * the root zone for csp-nijmegen.nl. This will only
   * have an actual effect in the prod. account.
   *
   * @returns null
   */
  addNSToRootCSPzone() {
    if (!this.zone.hostedZoneNameServers) { return; }
    new Route53.NsRecord(this, 'ns-record', {
      zone: this.accountRootZone,
      values: this.zone.hostedZoneNameServers,
      recordName: 'mijn',
    });
  }

  /**
   * Import the zone for csp-nijmegen.nl and add
   * the necessary txt-record for proving domain
   * ownership.
   */
  addDomainValidationRecord() {

    //accp
    new Route53.CnameRecord(this, 'validation-record-accp', {
      zone: this.accountRootZone,
      recordName: '_f7efe25b3a753b7b4054d2dba93a343b',
      domainName: '1865949c9e0474591398be17540a8383.626b224344a3e3acc3b0f4b67b2a52d3.comodoca.com.',
    });

    //csp
    new Route53.CnameRecord(this, 'validation-record-prod', {
      zone: this.accountRootZone,
      recordName: '_f73d66ee2c385b8dfc18ace27cb99644',
      domainName: '2e45a999777f5fe42487a28040c9c926.897f69591e347cfdce9e9d66193f750d.comodoca.com.',
    });
  }

  /**
   * Add DS record for the zone to the parent zone
   * to establish a chain of trust (https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-configuring-dnssec-enable-signing.html#dns-configuring-dnssec-chain-of-trust)
   */
  addDsRecord() {
    let dsValue = '';
    switch (this.branch) {
      case 'acceptance':
        dsValue = '52561 13 2 90CF3C35FDDC30AF42FB4BCCDCCB1123500050D70F1D4886D6DE25502F3BC50A';
        break;
      case 'production':
        dsValue = '60066 13 2 932CD585B029E674E17C4C33DFE7DE2C84353ACD8C109760FD17A6CDBD0CF3FA';
        break;
      default:
        break;
    }
    new Route53.DsRecord(this, 'ds-record', {
      zone: this.accountRootZone,
      recordName: 'mijn',
      values: [dsValue],
      ttl: Duration.seconds(600),
    });
  }
}