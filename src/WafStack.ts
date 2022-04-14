import { DefaultWafwebaclProps } from '@aws-solutions-constructs/core';
import { ArnFormat, aws_ssm as SSM, aws_wafv2, Stack, StackProps } from 'aws-cdk-lib';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { Statics } from './statics';

export class WafStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    const acl = new aws_wafv2.CfnWebACL(this, 'waf', DefaultWafwebaclProps('CLOUDFRONT'));
    new SSM.StringParameter(this, 'mijn-acl-id', {
      stringValue: acl.attrArn,
      parameterName: Statics.ssmWafAclArn,
    });
    
    this.setupWafLogging(acl);
  }

  private setupWafLogging(acl: aws_wafv2.CfnWebACL) {
    const logGroupArn = this.logGroupArn();

    new aws_wafv2.CfnLoggingConfiguration(this, 'waf-logging', {
      logDestinationConfigs: [logGroupArn],
      resourceArn: acl.attrArn,
    });

  }

  /** WafV2 doesn't return the correct form for its ARN.
   * workaround to format correctly
   * https://github.com/aws/aws-cdk/issues/18253
   */
  private logGroupArn() {
    const logGroup = new LogGroup(this, 'waf-logs', {
      logGroupName: 'aws-waf-logs-mijn-nijmegen',
    });

    const logGroupArn = this.formatArn({
      arnFormat: ArnFormat.COLON_RESOURCE_NAME,
      service: "logs",
      resource: "log-group",
      resourceName: logGroup.logGroupName
    });
    return logGroupArn;
  }
}