import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CloudfrontStack } from '../src/CloudfrontStack';

test('Distribution cache behavior order', async() => {
  const app = new App();
  const stack = new CloudfrontStack(app, 'teststack', {
    branch: 'acceptance',
    hostDomain: 'example.com',
  });
  const template = Template.fromStack(stack);
  template.hasResource('AWS::CloudFront::Distribution', {});
});
