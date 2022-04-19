import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Dotenv from 'dotenv';
import { ApiStack } from '../src/ApiStack';
import { ParameterStack } from '../src/ParameterStage';
import { PipelineStackDevelopment } from '../src/PipelineStackDevelopment';
import { SessionsStack } from '../src/SessionsStack';
import { DNSStack } from '../src/DNSStack';
import { KeyStack } from '../src/keystack';

beforeAll(() => {
  Dotenv.config();
});

test('Snapshot', () => {
  const app = new App();
  const stack = new PipelineStackDevelopment(app, 'test', { env: { account: 'test', region: 'eu-west-1' }, branchName: 'development', deployToEnvironment: { account: 'test', region: 'eu-west-1' } });
  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});

test('MainPipelineExists', () => {
  const app = new App();
  const stack = new PipelineStackDevelopment(app, 'test', { env: { account: 'test', region: 'eu-west-1' }, branchName: 'development', deployToEnvironment: { account: 'test', region: 'eu-west-1' } });
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::CodePipeline::Pipeline', 1);
});

test('StackHasSessionsTable', () => {
  const app = new App();
  const keyStack = new KeyStack(app, 'keystack');
  const stack = new SessionsStack(app, 'test', { key: keyStack.key});
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::DynamoDB::Table', 1);
  template.hasResourceProperties('AWS::DynamoDB::Table', {
    AttributeDefinitions: [
      {
        AttributeName: 'sessionid',
        AttributeType: 'S',
      },
    ],
  });
});

test('StackHasApiGateway', () => {
  const app = new App();
  const keyStack = new KeyStack(app, 'keystack');
  const sessionsStack = new SessionsStack(app, 'test', { key: keyStack.key});
  new DNSStack(app, 'dns', { branch: 'dev'});
  // const zone = dnsStack.zone;
  const stack = new ApiStack(app, 'api', { sessionsTable: sessionsStack.sessionsTable, branch: 'dev' });
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
});


test('StackHasLambdas', () => {
  const app = new App();
  const keyStack = new KeyStack(app, 'keystack');
  const sessionsStack = new SessionsStack(app, 'test', { key: keyStack.key});
  new DNSStack(app, 'dns', { branch: 'dev'});
  // const zone = dnsStack.zone;
  const stack = new ApiStack(app, 'api', { sessionsTable: sessionsStack.sessionsTable, branch: 'dev' });
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::Lambda::Function', 6);
});


test('StackHasParameters', () => {
  const app = new App();
  const stack = new ParameterStack(app, 'test');
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::SSM::Parameter', 7);
});


test('StackHasSecrets', () => {
  const app = new App();
  const stack = new ParameterStack(app, 'test');
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::SecretsManager::Secret', 2);
});


// test('StackHasCFDistribution', () => {
//   const app = new App();
//   const sessionsStack = new SessionsStack(app, 'sessions');
//   const stack = new ApiStack(app, 'api', { sessionsTable: sessionsStack.sessionsTable });
//   const template = Template.fromStack(stack);
//   console.log(JSON.stringify(template));
//   template.resourceCountIs('AWS::CloudFront::Distribution', 1);
// });