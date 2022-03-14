import { aws_route53 as Route53, aws_route53_targets as Route53Targets, Stack, StackProps, aws_ssm as SSM } from 'aws-cdk-lib';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import { Statics } from './statics';

export interface DNSStackProps extends StackProps {
  branch: string;
}

export class DNSStack extends Stack {
  cspRootZone: Route53.IHostedZone;
  branch: string;

  constructor(scope: Construct, id: string, props: DNSStackProps) {
    super(scope, id);
    this.branch = props.branch;
    const subdomain = Statics.subDomain(this.branch);
    new Route53.HostedZone(this, 'mijn-csp', {
      zoneName: `${subdomain}.csp-nijmegen.nl`,
    });
    const rootZoneId = SSM.StringParameter.valueForStringParameter(this, Statics.cspRootZoneId);
    const rootZoneName = SSM.StringParameter.valueForStringParameter(this, Statics.cspRootZoneName);
    this.cspRootZone = Route53.HostedZone.fromHostedZoneAttributes(this, 'cspzone', {
      hostedZoneId: rootZoneId,
      zoneName: rootZoneName,
    });
    this.addDomainValidationRecord();
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

  addCloudFrontRecords(distribution: Distribution) {
    new Route53.ARecord(this, 'eform-cdn-record', {
      zone: this.cspRootZone,
      target: Route53.RecordTarget.fromAlias(new Route53Targets.CloudFrontTarget(distribution)),
    });

    new Route53.AaaaRecord(this, 'eform-cdn-record-ipv6', {
      zone: this.cspRootZone,
      target: Route53.RecordTarget.fromAlias(new Route53Targets.CloudFrontTarget(distribution)),
    });
  }
}
