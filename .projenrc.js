const { GemeenteNijmegenCdkApp } = require('@gemeentenijmegen/projen-project-type');
const project = new GemeenteNijmegenCdkApp({
  cdkVersion: '2.22.0',
  defaultReleaseBranch: 'production',
  majorVersion: 1,
  name: 'mijnnijmegen',
  deps: [
    '@aws-lambda-powertools/logger',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/client-secrets-manager',
    '@gemeentenijmegen/projen-project-type',
    '@gemeentenijmegen/aws-constructs',
    '@gemeentenijmegen/apiclient',
    '@gemeentenijmegen/apigateway-http',
    '@gemeentenijmegen/session',
    '@gemeentenijmegen/utils',
    'dotenv',
    '@aws-cdk/aws-apigatewayv2-alpha',
    '@aws-cdk/aws-apigatewayv2-integrations-alpha',
    '@aws-sdk/client-secrets-manager',
    '@aws-solutions-constructs/aws-lambda-dynamodb',
    'cdk-remote-stack',
    'openid-client',
    'mustache',
    '@types/mustache',
    'axios',
    'cookie',
    'openid-client',
  ], /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: [
    '@types/aws-lambda',
    '@aws-sdk/types',
    'aws-sdk-client-mock',
    'axios-mock-adapter',
    'copyfiles',
    '@playwright/test',
    '@playwright/test',
    '@axe-core/playwright',
    'aws-sdk-client-mock',
    '@glen/jest-raw-loader',
  ], /* Build dependencies for this module. */
  mutableBuild: true,
  jestOptions: {
    jestConfig: {
      setupFiles: ['dotenv/config'],
      moduleFileExtensions: [
        'js', 'json', 'jsx', 'ts', 'tsx', 'node', 'mustache',
      ],
      transform: {
        '\\.[jt]sx?$': 'ts-jest',
        '^.+\\.mustache$': '@glen/jest-raw-loader',
      },
      testPathIgnorePatterns: ['/node_modules/', '/cdk.out', '/test/playwright'],
      roots: ['src', 'test'],
    },
  },
  eslintOptions: {
    devdirs: ['src/app/login/tests', 'src/app/auth/tests', 'src/app/home/tests', 'src/app/uitkeringen/tests', 'src/app/logout/tests', '/test', '/build-tools', 'src/shared/tests'],
  },
  bundlerOptions: {
    loaders: {
      mustache: 'text',
    },
  },
  gitignore: [
    'src/app/**/tests/output',
    'test/playwright/report',
    'test/playwright/screenshots',
  ],
});


project.synth();
