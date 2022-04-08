import { DefaultWafwebaclProps } from '@aws-solutions-constructs/core';
import { aws_ssm as SSM, aws_wafv2, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './statics';

export class WafStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    const acl = new aws_wafv2.CfnWebACL(this, 'waf', DefaultWafwebaclProps('CLOUDFRONT'));

    new SSM.StringParameter(this, 'mijn-acl-id', {
      stringValue: acl.attrId,
      parameterName: Statics.ssmWafAclId,
    });
  }
}