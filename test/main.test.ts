import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
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
  zakenUseSubmissions: false,
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
  template.resourceCountIs('AWS::Lambda::Function', 9);
});

test('Yivi feature flags come from the configuration', () => {
  const envOf = (configuration: Configuration) => {
    const app = new App();
    const keyStack = new KeyStack(app, 'keystack');
    const sessionsStack = new SessionsStack(app, 'test', { key: keyStack.key });
    const stack = new ApiStack(app, 'api', { sessionsTable: sessionsStack.sessionsTable, branch: 'test', configuration });
    const login: any = Object.values(Template.fromStack(stack).findResources('AWS::Lambda::Function', {
      Properties: { Description: 'Login-pagina voor de Mijn Nijmegen-applicatie.' },
    }))[0];
    const { USE_YIVI_SIGNICAT, USE_YIVI_VERID } = login.Properties.Environment.Variables;
    return { USE_YIVI_SIGNICAT, USE_YIVI_VERID };
  };
  expect(envOf(config)).toEqual({ USE_YIVI_SIGNICAT: 'true', USE_YIVI_VERID: 'false' });
  expect(envOf({ ...config, useYiviSignicat: false, useYiviVerId: true }))
    .toEqual({ USE_YIVI_SIGNICAT: 'false', USE_YIVI_VERID: 'true' });
});


test('VerIdParametersExist', () => {
  const app = new App();
  const stack = new ParameterStack(app, 'test', { configuration: config });
  const template = Template.fromStack(stack);
  for (const name of ['issuer-uri', 'client-id', 'redirect-url']) {
    template.hasResourceProperties('AWS::SSM::Parameter', { Name: `/cdk/mijn-nijmegen/verid/${name}` });
  }
  template.hasResourceProperties('AWS::SSM::Parameter', { Name: '/cdk/mijn-nijmegen/verid/scope', Value: 'openid nin' });
});

test('VerIdWiredIntoLoginAndAuthLambdas', () => {
  const app = new App();
  const keyStack = new KeyStack(app, 'keystack');
  const sessionsStack = new SessionsStack(app, 'test', { key: keyStack.key });
  new DNSStack(app, 'dns', { env: mockEnv, configuration: config });
  const stack = new ApiStack(app, 'api', { sessionsTable: sessionsStack.sessionsTable, branch: 'test', configuration: config });
  const template = Template.fromStack(stack);

  // Verifier store: partition key pk, TTL on ttl
  template.hasResourceProperties('AWS::DynamoDB::Table', {
    KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }],
    TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
    BillingMode: 'PAY_PER_REQUEST',
    // Holds tokens with the BSN: encrypted with the customer managed key, like the sessions table
    SSESpecification: { SSEEnabled: true, SSEType: 'KMS' },
  });

  const verIdEnv = ['USE_YIVI_VERID', 'VERID_ISSUER_URI', 'VERID_CLIENT_ID', 'VERID_REDIRECT_URL', 'VERID_SCOPE', 'VERID_ALLOW_TEST_NIN', 'VERID_CLIENT_SECRET_ARN', 'VERID_CACHE_TABLE'];
  for (const description of ['Login-pagina voor de Mijn Nijmegen-applicatie.', 'Authenticatie-lambda voor de Mijn Nijmegen-applicatie.']) {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Description: description,
      // Cold start (secrets) plus the VerID calls (discovery, intent, token exchange) do not fit the 3 second default
      Timeout: 10,
      Environment: { Variables: Match.objectLike(Object.fromEntries(verIdEnv.map(name => [name, Match.anyValue()]))) },
    });
  }
});

test('Log level follows the configuration, INFO by default', () => {
  const levelOf = (configuration: Configuration) => {
    const app = new App();
    const keyStack = new KeyStack(app, 'keystack');
    const sessionsStack = new SessionsStack(app, 'test', { key: keyStack.key });
    const stack = new ApiStack(app, 'api', { sessionsTable: sessionsStack.sessionsTable, branch: 'test', configuration });
    const apiFunctions = Object.values(Template.fromStack(stack).findResources('AWS::Lambda::Function'))
      .filter((resource: any) => resource.Properties.Environment?.Variables?.SESSION_TABLE);
    expect(apiFunctions.length).toBeGreaterThan(0);
    return new Set(apiFunctions.map((resource: any) => resource.Properties.Environment.Variables.POWERTOOLS_LOG_LEVEL));
  };
  expect(levelOf(config)).toEqual(new Set(['INFO']));
  expect(levelOf({ ...config, logLevel: 'DEBUG' })).toEqual(new Set(['DEBUG']));
});

test('StackHasParameters', () => {
  const app = new App();
  const stack = new ParameterStack(app, 'test', { configuration: config });
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::SSM::Parameter', 32);
});


test('StackHasSecrets', () => {
  const app = new App();
  const stack = new ParameterStack(app, 'test', { configuration: config });
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::SecretsManager::Secret', 11);
  template.hasResourceProperties('AWS::SecretsManager::Secret', { Name: '/cdk/mijn-nijmegen/verid/clientsecret' });
});


// test('StackHasCFDistribution', () => {
//   const app = new App();
//   const sessionsStack = new SessionsStack(app, 'sessions');
//   const stack = new ApiStack(app, 'api', { sessionsTable: sessionsStack.sessionsTable });
//   const template = Template.fromStack(stack);
//   console.log(JSON.stringify(template));
//   template.resourceCountIs('AWS::CloudFront::Distribution', 1);
// });
