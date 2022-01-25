import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Dotenv from 'dotenv';
import { ApiStack } from '../src/ApiStack';
import { ParameterStack } from '../src/ParameterStage';
import { PipelineStackDevelopment } from '../src/PipelineStackDevelopment';
import { SessionsStack } from '../src/SessionsStack';

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
  const stack = new SessionsStack(app, 'test');
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
  const sessionsStack = new SessionsStack(app, 'sessions');
  const stack = new ApiStack(app, 'api', { sessionsTable: sessionsStack.sessionsTable });
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
});


test('StackHasLambdas', () => {
  const app = new App();
  const sessionsStack = new SessionsStack(app, 'sessions');
  const stack = new ApiStack(app, 'api', { sessionsTable: sessionsStack.sessionsTable });
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::Lambda::Function', 3);
});



test('StackHasParameters', () => {
  const app = new App();
  const stack = new ParameterStack(app, 'test');
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::SSM::Parameter', 3);
});


test('StackHasSecrets', () => {
  const app = new App();
  const stack = new ParameterStack(app, 'test');
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::SecretsManager::Secret', 1);
});