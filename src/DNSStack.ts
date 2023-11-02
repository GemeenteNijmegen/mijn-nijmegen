import * as crypto from 'crypto';
import { aws_route53 as Route53, Stack, StackProps, aws_ssm as SSM, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './statics';

export interface DNSStackProps extends StackProps, Configurable { }

/** Setup DNS
 *
 * This stack is responsible for creating a project hosted zone in Route53
 * It sets up a DS record if provided (NB: In newer projects we have a [custom resource](https://www.npmjs.com/package/@gemeentenijmegen/dnssec-record) that provides DNSSEC, including the DS record)
 */

export class DNSStack extends Stack {
  zone: Route53.HostedZone;
  accountRootZone: Route53.IHostedZone;

  constructor(scope: Construct, id: string, props: DNSStackProps) {
    super(scope, id);

    const rootZoneId = SSM.StringParameter.valueForStringParameter(this, Statics.accountRootHostedZoneId);
    const rootZoneName = SSM.StringParameter.valueForStringParameter(this, Statics.accountRootHostedZoneName);

    this.accountRootZone = Route53.HostedZone.fromHostedZoneAttributes(this, 'cspzone', {
      hostedZoneId: rootZoneId,
      zoneName: rootZoneName,
    });

    this.zone = new Route53.HostedZone(this, 'mijn-csp', {
      zoneName: `mijn.${this.accountRootZone.zoneName}`,
    });

    this.addZoneIdAndNametoParams();
    this.addNSToRootCSPzone();
    this.addDsRecord(props.configuration.dsRecord);
    this.addCnameRecords(props.configuration.cnameRecords);

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
   * Add DS record for the zone to the parent zone
   * to establish a chain of trust (https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-configuring-dnssec-enable-signing.html#dns-configuring-dnssec-chain-of-trust)
   *
   * NB: Use https://www.npmjs.com/package/@gemeentenijmegen/dnssec-record in new projects
   */
  addDsRecord(dsValue?: string) {
    if (!dsValue) {
      return; // Skip DS record creation if there is no value.
    }

    new Route53.DsRecord(this, 'ds-record', {
      zone: this.accountRootZone,
      recordName: 'mijn',
      values: [dsValue],
      ttl: Duration.seconds(600),
    });
  }

  /**
   * Convenience method to add a set of CNAME records to the hosted zone
   */
  addCnameRecords(cnameRecords?: { [key: string]: string }) {
    if (!cnameRecords) {
      return; // No records to define
    }

    Object.entries(cnameRecords).forEach(record => {
      // Construct ID's must be unique. Generates a hash of the record to use as ID value.
      const hash = crypto.createHash('md5').update(`${record[0]}${record[1]}`).digest('hex').substring(0, 10);
      new Route53.CnameRecord(this, `cname-record-${hash}`, {
        recordName: record[0],
        domainName: record[1],
        zone: this.zone,
      });
    });
  }
}
