const { awscdk } = require('projen');
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.22.0',
  defaultReleaseBranch: 'production',
  release: true,
  majorVersion: 1,
  name: 'mijnnijmegen',
  license: 'EUPL-1.2',
  deps: [
    'dotenv',
    '@aws-cdk/aws-apigatewayv2-alpha',
    '@aws-cdk/aws-apigatewayv2-integrations-alpha',
    '@aws-solutions-constructs/aws-lambda-dynamodb',
    'cdk-remote-stack',
  ], /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: [
    'copyfiles',
    '@playwright/test',
  ], /* Build dependencies for this module. */
  depsUpgradeOptions: {
    workflowOptions: {
      branches: ['acceptance'],
    },
  },
  // packageName: undefined,  /* The "name" in package.json. */
  // release: undefined,      /* Add release management to this project. */
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
    'install:monitoring': 'cd src/monitoring/lambda && npm install',
    'postinstall': 'npm run install:login && npm run install:auth && npm run install:home && npm run install:logout && npm run install:monitoring',
    'post-upgrade': ' \
      (cd src/app/login && npx npm-check-updates -u --dep prod,dev && npm install) \
      && (cd src/app/home && npx npm-check-updates -u --dep prod,dev && npm install) \
      && (cd src/app/login && npx npm-check-updates -u --dep prod,dev && npm install) \
      && (cd src/app/logout && npx npm-check-updates -u --dep prod,dev && npm install)',
  },
  eslintOptions: {
    devdirs: ['src/app/login/tests', 'src/app/auth/tests', 'src/app/home/tests', 'src/app/uitkeringen/tests', 'src/app/logout/tests', '/test', '/build-tools'],
  },
  gitignore: [
    '.env',
    '.vscode',
    'src/app/**/shared',
    'src/app/**/tests/output',
    '.DS_Store',
    'test/playwright/report',
    'test/playwright/screenshots',
  ],
});

project.synth();