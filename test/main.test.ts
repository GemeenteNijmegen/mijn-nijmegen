import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { PipelineStackDevelopment } from '../src/main';

test('Snapshot', () => {
  const app = new App();
  const stack = new PipelineStackDevelopment(app, 'test', { branchName: 'test' });
  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});


test('HasDynamoDB', () => {
  const app = new App();
  const stack = new PipelineStackDevelopment(app, 'test', { branchName: 'test' });
  const template = Template.fromStack(stack);
  template.resourceCountIs("AWS::DynamoDB::Table", 1);
  template.hasResourceProperties('AWS::DynamoDB::Table', {
    AttributeDefinitions: [
      {
        "AttributeName": "sessionid",
        "AttributeType": "S",
      }
    ]
  });
});