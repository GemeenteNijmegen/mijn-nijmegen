import { aws_route53 as Route53, Stack, StackProps, aws_ssm as SSM, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './statics';

export interface DNSStackProps extends StackProps {
  branch: string;
}

export class DNSStack extends Stack {
  zone: Route53.HostedZone;
  cspRootZone: Route53.IHostedZone;
  fakeNijmegenZone: Route53.HostedZone;
  branch: string;

  constructor(scope: Construct, id: string, props: DNSStackProps) {
    super(scope, id);
    this.branch = props.branch;

    const rootZoneId = SSM.StringParameter.valueForStringParameter(this, Statics.cspRootZoneId);
    const rootZoneName = SSM.StringParameter.valueForStringParameter(this, Statics.cspRootZoneName);
    this.cspRootZone = Route53.HostedZone.fromHostedZoneAttributes(this, 'cspzone', {
      hostedZoneId: rootZoneId,
      zoneName: rootZoneName,
    });

    this.zone = new Route53.HostedZone(this, 'mijn-csp', {
      zoneName: `mijn.${this.cspRootZone.zoneName}`,
    });

    const subdomain = Statics.subDomain(this.branch);

    this.fakeNijmegenZone = new Route53.HostedZone(this, 'mijn-fake', {
      zoneName: `${subdomain}.nijmegen.nl`,
    });

    this.addZoneIdAndNametoParams();
    this.addNSToRootCSPzone();
    this.addDomainValidationRecord();
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

    new SSM.StringParameter(this, 'mijn-fake-hostedzone-id', {
      stringValue: this.fakeNijmegenZone.hostedZoneId,
      parameterName: Statics.ssmNijmegenZoneId,
    });

    new SSM.StringParameter(this, 'mijn-fake-hostedzone-name', {
      stringValue: this.fakeNijmegenZone.zoneName,
      parameterName: Statics.ssmNijmegenZoneName,
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

    new SSM.StringParameter(this, 'nijmegen-hostedzone-id', {
      stringValue: this.fakeNijmegenZone.hostedZoneId,
      parameterName: Statics.ssmNijmegenZoneIdNew,
    });

    new SSM.StringParameter(this, 'nijmegen-hostedzone-name', {
      stringValue: this.fakeNijmegenZone.zoneName,
      parameterName: Statics.ssmNijmegenZoneNameNew,
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
      zone: this.cspRootZone,
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
      zone: this.cspRootZone,
      recordName: '_f7efe25b3a753b7b4054d2dba93a343b',
      domainName: '1865949c9e0474591398be17540a8383.626b224344a3e3acc3b0f4b67b2a52d3.comodoca.com.',
    });

    //csp
    new Route53.CnameRecord(this, 'validation-record-prod', {
      zone: this.cspRootZone,
      recordName: '_f73d66ee2c385b8dfc18ace27cb99644',
      domainName: '2e45a999777f5fe42487a28040c9c926.897f69591e347cfdce9e9d66193f750d.comodoca.com.',
    });
  }

  /**
   * Add DS record for the zone to the parent zone
   * to establish a chain of trust (https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-configuring-dnssec-enable-signing.html#dns-configuring-dnssec-chain-of-trust)
   */
  addDsRecord() {
    const subdomain = Statics.subDomain(this.branch);
    new Route53.DsRecord(this, 'ds-record', {
      zone: this.cspRootZone,
      recordName: subdomain,
      values: [SSM.StringParameter.valueForStringParameter(this, Statics.ssmNijmegenDSRecordValue)],
      ttl: Duration.seconds(600)
    });
  }
}