const { GemeenteNijmegenCdkApp } = require('@gemeentenijmegen/projen-project-type');
const project = new GemeenteNijmegenCdkApp({
  cdkVersion: '2.22.0',
  defaultReleaseBranch: 'production',
  majorVersion: 1,
  name: 'mijnnijmegen',
  deps: [
    '@gemeentenijmegen/projen-project-type',
    'dotenv',
    '@aws-cdk/aws-apigatewayv2-alpha',
    '@aws-cdk/aws-apigatewayv2-integrations-alpha',
    '@aws-sdk/client-secrets-manager',
    '@aws-solutions-constructs/aws-lambda-dynamodb',
    'cdk-remote-stack',
    'openid-client',
    'mustache',
  ], /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: [
    'copyfiles',
    '@playwright/test',
    '@playwright/test',
    '@axe-core/playwright',
    'aws-sdk-client-mock'
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
    'install:login': 'copyfiles -f src/shared/* src/app/login/shared && cd src/app/login && npm install',
    'install:auth': 'copyfiles -f src/shared/* src/app/auth/shared && cd src/app/auth && npm install',
    'install:home': 'copyfiles -f src/shared/* src/app/home/shared && cd src/app/home && npm install',
    'install:logout': 'copyfiles -f src/shared/* src/app/logout/shared && cd src/app/logout && npm install',
    'postinstall': 'npm run install:login && npm run install:auth && npm run install:home && npm run install:logout',
    'post-upgrade': ' \
      (cd src/app/login && npx npm-check-updates -u --dep prod,dev && npm install) \
      && (cd src/app/home && npx npm-check-updates -u --dep prod,dev && npm install) \
      && (cd src/app/auth && npx npm-check-updates -u --dep prod,dev && npm install) \
      && (cd src/app/logout && npx npm-check-updates -u --dep prod,dev && npm install)',
  },
  eslintOptions: {
    devdirs: ['src/app/login/tests', 'src/app/auth/tests', 'src/app/home/tests', 'src/app/uitkeringen/tests', 'src/app/logout/tests', '/test', '/build-tools'],
  },
  gitignore: [
    'src/app/**/shared',
    'src/app/**/tests/output',
    'test/playwright/report',
    'test/playwright/screenshots',
  ],
});


project.synth();