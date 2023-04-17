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
    'axios',
    'cookie',
    'openid-client',
  ], /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: [
    '@aws-sdk/types',
    'aws-sdk-client-mock',
    'axios-mock-adapter',
    'copyfiles',
    '@playwright/test',
    '@playwright/test',
    '@axe-core/playwright',
    'aws-sdk-client-mock',
  ], /* Build dependencies for this module. */
  mutableBuild: true,
  jestOptions: {
    jestConfig: {
      setupFiles: ['dotenv/config'],
      testPathIgnorePatterns: ['/node_modules/', '/cdk.out', '/test/playwright'],
      roots: ['src', 'test'],
    },
  },
  scripts: {
    'install:login': 'copyfiles -f src/shared/*.mustache src/app/login/shared',
    'install:auth': 'copyfiles -f src/shared/*.mustache src/app/auth/shared',
    'install:home': 'copyfiles -f src/shared/*.mustache src/app/home/shared',
    'install:logout': 'copyfiles -f src/shared/*.mustache src/app/logout/shared',
    'postinstall': 'npm run install:login && npm run install:auth && npm run install:home && npm run install:logout',
  },
  eslintOptions: {
    devdirs: ['src/app/login/tests', 'src/app/auth/tests', 'src/app/home/tests', 'src/app/uitkeringen/tests', 'src/app/logout/tests', '/test', '/build-tools', 'src/shared/tests'],
  },
  gitignore: [
    'src/app/**/tests/output',
    'test/playwright/report',
    'test/playwright/screenshots',
  ],
});


project.synth();