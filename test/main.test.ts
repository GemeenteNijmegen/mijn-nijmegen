import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Dotenv from 'dotenv';
import { ApiStack } from '../src/ApiStack';
import { Configuration } from '../src/Configuration';
import { DNSStack } from '../src/DNSStack';
import { KeyStack } from '../src/keystack';
import { ParameterStack } from '../src/ParameterStage';
import { PipelineStack } from '../src/PipelineStack';
import { SessionsStack } from '../src/SessionsStack';

const mockEnv = {
  account: '123456789012',
  region: 'eu-central-1',
};

const config: Configuration = {
  branch: 'test',
  buildEnvironment: mockEnv,
  deploymentEnvironment: mockEnv,
  cnameRecords: {
    _1241251: '120421305.csp-nijmegen.nl',
  },
  dsRecord: undefined,
  pipelineStackCdkName: 'mijnnijmegen-pipeline-stack-testing',
  pipelineName: 'mijnnijmegen-test',
  zakenAllowDomains: [],
  zakenIsLive: false,
  zakenUseSubmissions: false,
  zakenUseTaken: false,
};

beforeAll(() => {
  Dotenv.config();
});

test('Snapshot', () => {
  const app = new App();
  const stack = new PipelineStack(app, 'test', { env: mockEnv, configuration: config });
  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});

test('MainPipelineExists', () => {
  const app = new App();
  const stack = new PipelineStack(app, 'test', { env: mockEnv, configuration: config });
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::CodePipeline::Pipeline', 1);
});

test('StackHasSessionsTable', () => {
  const app = new App();
  const keyStack = new KeyStack(app, 'keystack');
  const stack = new SessionsStack(app, 'test', { key: keyStack.key });
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
  const sessionsStack = new SessionsStack(app, 'test', { key: keyStack.key });
  new DNSStack(app, 'dns', { env: mockEnv, configuration: config });
  // const zone = dnsStack.zone;
  const stack = new ApiStack(app, 'api', { sessionsTable: sessionsStack.sessionsTable, branch: 'test', configuration: config });
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
});


test('StackHasLambdas', () => {
  const app = new App();
  const keyStack = new KeyStack(app, 'keystack');
  const sessionsStack = new SessionsStack(app, 'test', { key: keyStack.key });
  new DNSStack(app, 'dns', { env: mockEnv, configuration: config });
  // const zone = dnsStack.zone;
  const stack = new ApiStack(app, 'api', { sessionsTable: sessionsStack.sessionsTable, branch: 'test', configuration: config });
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::Lambda::Function', 8);
});


test('StackHasParameters', () => {
  const app = new App();
  const stack = new ParameterStack(app, 'test');
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::SSM::Parameter', 22);
});


test('StackHasSecrets', () => {
  const app = new App();
  const stack = new ParameterStack(app, 'test');
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::SecretsManager::Secret', 8);
});


// test('StackHasCFDistribution', () => {
//   const app = new App();
//   const sessionsStack = new SessionsStack(app, 'sessions');
//   const stack = new ApiStack(app, 'api', { sessionsTable: sessionsStack.sessionsTable });
//   const template = Template.fromStack(stack);
//   console.log(JSON.stringify(template));
//   template.resourceCountIs('AWS::CloudFront::Distribution', 1);
// });
